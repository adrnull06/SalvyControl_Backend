// Lógica de negocio de la autenticación, separada de las rutas: las rutas solo reciben y responden,
// el servicio decide. Así esta lógica se puede reutilizar y probar sin levantar el servidor.
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { rol, usuario } from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import { AppError, noAutenticado, prohibido } from '../../utils/errors.js';

export type RolNombre = 'admin' | 'superadmin';
export interface UsuarioSesion {
  id: number;
  usuario: string;
  rol: RolNombre;
}

export const SESION_SEGUNDOS = 8 * 60 * 60;

// Hash de una contraseña inventada. Si el usuario NO existe, igual verificamos contra este hash
// para que la respuesta tarde lo mismo que con un usuario real. Sin esto, un atacante mide los
// tiempos y descubre qué usuarios existen (ataque de "temporización"). Se calcula una sola vez al arrancar.
const HASH_FALSO = await argon2.hash('contrasena-que-nadie-usa');

// Comprueba usuario y contraseña. Devuelve el token (para la cookie) y los datos de sesión.
export async function iniciarSesion(nombre: string, contrasena: string) {
  const [u] = await db
    .select({
      id: usuario.idUsuario,
      usuario: usuario.usuario,
      contrasenaHash: usuario.contrasenaHash,
      estado: usuario.estado,
      rol: rol.nombre,
    })
    .from(usuario)
    .innerJoin(rol, eq(usuario.idRol, rol.id))
    .where(eq(usuario.usuario, nombre))
    .limit(1);

  const valida = await argon2.verify(u?.contrasenaHash ?? HASH_FALSO, contrasena);

  // Mismo mensaje para "no existe" y "clave incorrecta": no revelamos cuál de las dos falló.
  if (!u || !valida) throw noAutenticado('Usuario o contraseña incorrectos');

  // Aquí ya demostró conocer la contraseña, así que es seguro decirle que su cuenta está desactivada.
  if (u.estado !== 'activo') throw prohibido('Tu cuenta está desactivada. Contacta a un superadmin');

  // El token solo lleva el id (subject). Rol y estado se consultan en cada petición (ver middleware).
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: String(u.id),
    expiresIn: SESION_SEGUNDOS,
    algorithm: 'HS256',
  });
  const sesion: UsuarioSesion = { id: u.id, usuario: u.usuario, rol: u.rol as RolNombre };
  return { token, sesion };
}

// Lo usa el middleware en cada petición: devuelve al usuario SOLO si sigue existiendo y activo.
export async function buscarUsuarioActivo(id: number): Promise<UsuarioSesion | null> {
  const [u] = await db
    .select({ id: usuario.idUsuario, usuario: usuario.usuario, estado: usuario.estado, rol: rol.nombre })
    .from(usuario)
    .innerJoin(rol, eq(usuario.idRol, rol.id))
    .where(eq(usuario.idUsuario, id))
    .limit(1);
  if (!u || u.estado !== 'activo') return null;
  // La tabla rol solo contiene 'admin' y 'superadmin' (datos semilla), por eso el cast es seguro.
  return { id: u.id, usuario: u.usuario, rol: u.rol as RolNombre };
}

export async function cambiarContrasena(id: number, actual: string, nueva: string) {
  const [u] = await db
    .select({ hash: usuario.contrasenaHash })
    .from(usuario)
    .where(eq(usuario.idUsuario, id))
    .limit(1);
  if (!u || !(await argon2.verify(u.hash, actual))) {
    // Usamos 400 y NO 401: un 401 haría que el frontend piense que la sesión murió y te saque al login.
    throw new AppError(400, 'CONTRASENA_ACTUAL_INCORRECTA', 'La contraseña actual es incorrecta');
  }
  const nuevoHash = await argon2.hash(nueva); // argon2id con parámetros por defecto seguros
  await db.update(usuario).set({ contrasenaHash: nuevoHash }).where(eq(usuario.idUsuario, id));
}