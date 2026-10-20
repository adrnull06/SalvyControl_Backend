import argon2 from 'argon2';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { rol, usuario } from '../../db/schema/index.js';
import { AppError, codigoPg, conflicto, noEncontrado, prohibido } from '../../utils/errors.js';
import { patronBusqueda } from '../../utils/validacion.js';
import type { CambiosUsuario, DatosUsuario, ListarUsuarios } from './usuarios.schemas.js';
import { filtroTexto } from '../../utils/busqueda.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]; // tipo de `tx` dentro de una transacción
const MAX_SUPERADMIN = 2;

// Columnas que salen hacia el frontend. NUNCA incluimos contrasenaHash: se elige columna por
// columna (en vez de select()) para que un campo sensible no se filtre por descuido.
const columnas = {
  idUsuario: usuario.idUsuario,
  usuario: usuario.usuario,
  rol: rol.nombre,
  estado: usuario.estado,
  fechaCreacion: usuario.fechaCreacion,
};

const consultaUsuarios = (donde?: SQL) =>
  db.select(columnas).from(usuario).innerJoin(rol, eq(usuario.idRol, rol.id)).where(donde);

export async function listarUsuarios({ filtro, q }: ListarUsuarios) {
  const donde = and(
    filtro === 'activos' ? eq(usuario.estado, 'activo') : undefined,
    filtro === 'inactivos' ? eq(usuario.estado, 'inactivo') : undefined,
    filtroTexto(q, [usuario.usuario, rol.nombre, usuario.estado]),
  );
  // Sin paginación (pocos usuarios); el límite es solo una red de seguridad.
  const datos = await consultaUsuarios(donde).orderBy(desc(usuario.fechaCreacion), desc(usuario.idUsuario)).limit(100);
  return { datos };
}

export async function obtenerUsuario(id: number) {
  const [u] = await consultaUsuarios(eq(usuario.idUsuario, id)).limit(1);
  if (!u) throw noEncontrado('Usuario');
  return u;
}

// { admin: 1, superadmin: 2 }: ids de los roles por nombre (vienen del seed).
async function idsDeRoles() {
  const filas = await db.select().from(rol);
  const admin = filas.find((r) => r.nombre === 'admin')?.id;
  const superadmin = filas.find((r) => r.nombre === 'superadmin')?.id;
  if (admin === undefined || superadmin === undefined) throw new Error('Faltan los roles. Ejecuta: npm run db:seed');
  return { admin, superadmin };
}

// La "puerta giratoria": solo UNA operación sobre superadmins a la vez en todo el sistema.
// Se libera sola al terminar la transacción. Después de entrar, volvemos a comprobar que quien
// actúa siga siendo superadmin ACTIVO: si otro superadmin lo desactivó un instante antes,
// su petición ya autenticada no debe tener efecto.
async function entrarAlCandado(tx: Tx, idActor: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(7001)`);
  const [actor] = await tx
    .select({ estado: usuario.estado, rol: rol.nombre })
    .from(usuario)
    .innerJoin(rol, eq(usuario.idRol, rol.id))
    .where(eq(usuario.idUsuario, idActor))
    .limit(1);
  if (!actor || actor.estado !== 'activo' || actor.rol !== 'superadmin') throw prohibido();
}

// Cuenta TODOS los superadmin (también desactivados: reactivarlos no debe permitir un tercero).
// Es una consulta nueva tras el candado, así que ve lo que otra operación acaba de guardar.
async function exigirCupoSuperadmin(tx: Tx, idRolSuper: number) {
  const [fila] = await tx.select({ n: count() }).from(usuario).where(eq(usuario.idRol, idRolSuper));
  if ((fila?.n ?? 0) >= MAX_SUPERADMIN)
    throw new AppError(409, 'LIMITE_SUPERADMIN', `Solo puede haber ${MAX_SUPERADMIN} superadmin`);
}

const usuarioEnUso = () => conflicto('Ese nombre de usuario ya está en uso');

export async function crearUsuario(d: DatosUsuario, idActor: number) {
  const contrasenaHash = await argon2.hash(d.contrasena); // fuera de la transacción: es lento
  const roles = await idsDeRoles();
  try {
    const id = await db.transaction(async (tx) => {
      await entrarAlCandado(tx, idActor);
      if (d.rol === 'superadmin') await exigirCupoSuperadmin(tx, roles.superadmin);
      const [creado] = await tx
        .insert(usuario)
        .values({ usuario: d.usuario, contrasenaHash, idRol: roles[d.rol] })
        .returning({ id: usuario.idUsuario });
      if (!creado) throw new Error('No se pudo crear el usuario');
      return creado.id;
    });
    return obtenerUsuario(id);
  } catch (err) {
    if (codigoPg(err) === '23505') throw usuarioEnUso(); // UNIQUE de usuario.usuario
    throw err;
  }
}

export async function actualizarUsuario(id: number, cambios: CambiosUsuario, idActor: number) {
  const esUnoMismo = id === idActor;
  // Reglas sobre uno mismo (como actor es superadmin, "rol distinto a superadmin" = bajarse el rol).
  if (esUnoMismo && cambios.estado === 'inactivo') throw prohibido('No puedes desactivarte a ti mismo');
  if (esUnoMismo && cambios.rol !== undefined && cambios.rol !== 'superadmin')
    throw prohibido('No puedes quitarte tu propio rol de superadmin');
  if (esUnoMismo && cambios.contrasena !== undefined)
    throw new AppError(400, 'USAR_CAMBIAR_CONTRASENA', 'Tu propia contraseña se cambia en "Cambiar contraseña" (pide la actual)');

  const contrasenaHash = cambios.contrasena !== undefined ? await argon2.hash(cambios.contrasena) : undefined;
  const roles = await idsDeRoles();

  try {
    await db.transaction(async (tx) => {
      await entrarAlCandado(tx, idActor);
      const [objetivo] = await tx
        .select({ rol: rol.nombre })
        .from(usuario)
        .innerJoin(rol, eq(usuario.idRol, rol.id))
        .where(eq(usuario.idUsuario, id))
        .limit(1);
      if (!objetivo) throw noEncontrado('Usuario');

      // Solo al SUBIR a alguien a superadmin se revisa el cupo (al bajar o editar otros datos no).
      if (cambios.rol === 'superadmin' && objetivo.rol !== 'superadmin') await exigirCupoSuperadmin(tx, roles.superadmin);

      const set: Partial<typeof usuario.$inferInsert> = {};
      if (cambios.usuario !== undefined) set.usuario = cambios.usuario;
      if (cambios.rol !== undefined) set.idRol = roles[cambios.rol];
      if (cambios.estado !== undefined) set.estado = cambios.estado;
      if (contrasenaHash !== undefined) set.contrasenaHash = contrasenaHash;
      await tx.update(usuario).set(set).where(eq(usuario.idUsuario, id));
    });
    return obtenerUsuario(id);
  } catch (err) {
    if (codigoPg(err) === '23505') throw usuarioEnUso();
    throw err;
  }
}