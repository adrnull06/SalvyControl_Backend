import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  cliente, estadoPaquete, estadoViaje, historialEstado, metodoEntrega, pago, paquete, usuario, viaje,
} from '../../db/schema/index.js';
import { AppError, noEncontrado } from '../../utils/errors.js';
import { generarCodigoPaquete } from '../../utils/codigos.js';
import { HOY_SV } from '../../utils/fechas.js';
import { POR_PAGINA, armarPaginacion, patronBusqueda } from '../../utils/validacion.js';
import type { CambiosPaquete, DatosPaquete, ListarPaquetes } from './paquetes.schemas.js';

// Columnas que ve el frontend: paquete + cliente + estado + método de entrega + viaje + precio.
// Van "planas" (clienteNombre, viajeOrigen...) porque con LEFT JOIN el viaje puede no existir.
// precioTotal = servicio + compra del pago; si no hay pago, la suma es NULL (se muestra "Sin definir").
const columnas = {
  idPaquete: paquete.idPaquete,
  codigoRastreo: paquete.codigoRastreo,
  idCliente: paquete.idCliente,
  clienteNombre: cliente.nombre,
  clienteTelefono: cliente.telefono,
  clienteCorreo: cliente.correo,
  tiendaProcedencia: paquete.tiendaProcedencia,
  descripcion: paquete.descripcion,
  observaciones: paquete.observaciones,
  pesoLibras: paquete.pesoLibras,
  idMetodoEntrega: paquete.idMetodoEntrega,
  metodoEntrega: metodoEntrega.nombre,
  lugarEntrega: paquete.lugarEntrega,
  fechaHoraRecepcion: paquete.fechaHoraRecepcion,
  idEstado: paquete.idEstadoActual,
  estado: estadoPaquete.nombre,
  idViaje: paquete.idViaje,
  codigoViaje: viaje.codigoViaje,
  viajeOrigen: viaje.lugarOrigen,
  viajeDestino: viaje.lugarDestino,
  precioTotal: sql<string | null>`${pago.costoServicio} + ${pago.costoCompra}`,
};

const consultaPaquetes = (donde?: SQL) =>
  db
    .select(columnas)
    .from(paquete)
    .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
    .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
    .innerJoin(metodoEntrega, eq(paquete.idMetodoEntrega, metodoEntrega.id))
    .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
    .leftJoin(pago, eq(pago.idPaquete, paquete.idPaquete))
    .where(donde);

const filtroAEstado = { listos: 'Listo para entregar', en_transito: 'En tránsito' } as const;
const masRecientes = [desc(paquete.fechaHoraRecepcion), desc(paquete.idPaquete)];
// El segundo criterio (id) hace el orden estable entre páginas.
const ordenes = { todos: [asc(paquete.idPaquete)], recientes: masRecientes, listos: masRecientes, en_transito: masRecientes };

export async function listarPaquetes({ pagina, q, filtro }: ListarPaquetes) {
  const patron = q ? patronBusqueda(q) : null;
  const donde = and(
    filtro === 'listos' || filtro === 'en_transito' ? eq(estadoPaquete.nombre, filtroAEstado[filtro]) : undefined,
    // Busca en lo que muestra la tabla. Por eso un clic en un correo o en un código de viaje
    // (que el frontend manda como ?q=) devuelve justo los paquetes relacionados.
    patron
      ? or(
          ilike(paquete.codigoRastreo, patron),
          ilike(viaje.codigoViaje, patron),
          ilike(cliente.nombre, patron),
          ilike(cliente.correo, patron),
          ilike(cliente.telefono, patron),
          ilike(paquete.tiendaProcedencia, patron),
          ilike(paquete.descripcion, patron),
          ilike(estadoPaquete.nombre, patron),
        )
      : undefined,
  );

  // El conteo usa solo los JOIN que el filtro necesita; respeta búsqueda y filtro rápido.
  const [[conteo], datos] = await Promise.all([
    db
      .select({ total: count() })
      .from(paquete)
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .where(donde),
    consultaPaquetes(donde)
      .orderBy(...ordenes[filtro])
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
  ]);
  return { datos, paginacion: armarPaginacion(pagina, conteo?.total ?? 0) };
}

export async function obtenerPaquete(id: number) {
  const [p] = await consultaPaquetes(eq(paquete.idPaquete, id)).limit(1);
  if (!p) throw noEncontrado('Paquete');
  return p;
}

// Detalle = el paquete + su línea de tiempo de estados (cuándo y quién).
export async function detallePaquete(id: number) {
  const p = await obtenerPaquete(id);
  const historial = await db
    .select({ estado: estadoPaquete.nombre, fechaCambio: historialEstado.fechaCambio, usuario: usuario.usuario })
    .from(historialEstado)
    .innerJoin(estadoPaquete, eq(historialEstado.idEstado, estadoPaquete.id))
    .innerJoin(usuario, eq(historialEstado.idUsuario, usuario.idUsuario))
    .where(eq(historialEstado.idPaquete, id))
    .orderBy(asc(historialEstado.fechaCambio), asc(historialEstado.idHistorial));
  return { ...p, historial };
}

// Opciones para el combo de "Nuevo pago": código + ORIGEN (tienda) + cliente, como pediste.
// `tienePago` permite al frontend avisar si ese paquete ya tiene un pago (solo puede haber uno).
// Máximo 20 resultados: es un buscador mientras se escribe, no una lista completa.
export async function opcionesPaquetes(q?: string) {
  const patron = q ? patronBusqueda(q) : null;
  return db
    .select({
      idPaquete: paquete.idPaquete,
      codigoRastreo: paquete.codigoRastreo,
      tiendaProcedencia: paquete.tiendaProcedencia,
      clienteNombre: cliente.nombre,
      estado: estadoPaquete.nombre,
      tienePago: sql<boolean>`${pago.idPago} is not null`,
    })
    .from(paquete)
    .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
    .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
    .leftJoin(pago, eq(pago.idPaquete, paquete.idPaquete))
    .where(
      patron
        ? or(ilike(paquete.codigoRastreo, patron), ilike(paquete.tiendaProcedencia, patron), ilike(cliente.nombre, patron))
        : undefined,
    )
    .orderBy(desc(paquete.idPaquete))
    .limit(20);
}

// --- Validaciones con mensaje claro (si no, la BD respondería un genérico "referencia inválida") ---
async function exigirCliente(id: number) {
  if ((await db.$count(cliente, eq(cliente.idCliente, id))) === 0)
    throw new AppError(400, 'CLIENTE_INVALIDO', 'El cliente seleccionado no existe');
}
async function exigirEstado(id: number) {
  if ((await db.$count(estadoPaquete, eq(estadoPaquete.id, id))) === 0)
    throw new AppError(400, 'ESTADO_INVALIDO', 'El estado seleccionado no existe');
}
async function exigirMetodoEntrega(id: number) {
  if ((await db.$count(metodoEntrega, eq(metodoEntrega.id, id))) === 0)
    throw new AppError(400, 'METODO_ENTREGA_INVALIDO', 'El método de entrega seleccionado no existe');
}
async function exigirViajePlanificado(id: number) {
  const [v] = await db
    .select({ estado: estadoViaje.nombre })
    .from(viaje)
    .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
    .where(eq(viaje.idViaje, id))
    .limit(1);
  if (!v) throw new AppError(400, 'VIAJE_INVALIDO', 'El viaje seleccionado no existe');
  if (v.estado !== 'Planificado')
    throw new AppError(409, 'VIAJE_NO_PLANIFICADO', 'Solo se pueden asignar paquetes a viajes planificados');
}

// Paquete + su primera fila de historial, en UNA transacción (o se guarda todo o nada).
// El código tiene parte aleatoria: `onConflictDoNothing` evita el error si ya existía y nos
// devuelve vacío, entonces probamos otro código. (Dentro de una transacción NO podemos usar
// try/catch con el error 23505: PostgreSQL anula toda la transacción tras un error.)
export async function crearPaquete(datos: DatosPaquete, idUsuario: number) {
  const { idEstadoInicial, ...resto } = datos;
  await exigirCliente(resto.idCliente);
  await exigirEstado(idEstadoInicial);
  await exigirMetodoEntrega(resto.idMetodoEntrega);
  if (resto.idViaje) await exigirViajePlanificado(resto.idViaje);

  const id = await db.transaction(async (tx) => {
    for (let intento = 0; intento < 5; intento++) {
      const [creado] = await tx
        .insert(paquete)
        .values({ ...resto, idEstadoActual: idEstadoInicial, codigoRastreo: generarCodigoPaquete() })
        .onConflictDoNothing({ target: paquete.codigoRastreo })
        .returning({ id: paquete.idPaquete });
      if (!creado) continue;
      await tx.insert(historialEstado).values({
        idPaquete: creado.id,
        idEstado: idEstadoInicial,
        idUsuario,
        fechaCambioEstado: HOY_SV,
      });
      return creado.id;
    }
    throw new Error('No se pudo generar un código de rastreo único');
  });
  return obtenerPaquete(id);
}

export async function actualizarPaquete(id: number, cambios: CambiosPaquete) {
  const actual = await obtenerPaquete(id);
  if (cambios.idCliente !== undefined) await exigirCliente(cambios.idCliente);
  if (cambios.idMetodoEntrega !== undefined) await exigirMetodoEntrega(cambios.idMetodoEntrega);
  // Solo exigimos "Planificado" si el viaje CAMBIA: un paquete puede seguir en un viaje ya en proceso.
  if (cambios.idViaje && cambios.idViaje !== actual.idViaje) await exigirViajePlanificado(cambios.idViaje);

  await db.update(paquete).set(cambios).where(eq(paquete.idPaquete, id));
  return obtenerPaquete(id);
}

// Cambia el estado de uno o varios paquetes y deja la huella en el historial (transacción).
// `.for('update')` bloquea esas filas mientras dura la transacción: si dos personas cambian el
// mismo paquete a la vez, la segunda espera en vez de pisar a la primera.
export async function cambiarEstado(ids: number[], idEstado: number, idUsuario: number, soloDesdeEstado?: number) {
  await exigirEstado(idEstado);
  return db.transaction(async (tx) => {
    const existentes = await tx
      .select({ id: paquete.idPaquete, estado: paquete.idEstadoActual })
      .from(paquete)
      .where(inArray(paquete.idPaquete, ids))
      .for('update');
    if (existentes.length === 0) throw noEncontrado('Paquete');

    const aCambiar = existentes
      .filter((p) => p.estado !== idEstado && (soloDesdeEstado === undefined || p.estado === soloDesdeEstado))
      .map((p) => p.id);
    if (aCambiar.length > 0) {
      await tx.update(paquete).set({ idEstadoActual: idEstado }).where(inArray(paquete.idPaquete, aCambiar));
      await tx
        .insert(historialEstado)
        .values(aCambiar.map((idPaquete) => ({ idPaquete, idEstado, idUsuario, fechaCambioEstado: HOY_SV })))
        .onConflictDoUpdate({
          target: [historialEstado.idPaquete, historialEstado.idEstado, historialEstado.fechaCambioEstado],
          set: { fechaCambio: sql`now()`, idUsuario },
        });
    }
    // sinCambio = ya estaban en el estado destino. noElegibles = estaban en otro estado distinto
    // al exigido (solo puede ser > 0 si se usó soloDesdeEstado).
    const sinCambio = existentes.filter((p) => p.estado === idEstado).length;
    return {
      cambiados: aCambiar.length,
      sinCambio,
      noElegibles: existentes.length - aCambiar.length - sinCambio,
      noEncontrados: ids.length - existentes.length,
    };
  });
}

// Todo o nada. Un paquete con pago no se elimina: se perdería el registro de dinero.
// Primero hay que eliminar su pago. (El historial de estados sí se borra junto al paquete.)
export async function eliminarPaquetes(ids: number[]) {
  const conPago = await db
    .select({ id: paquete.idPaquete, codigo: paquete.codigoRastreo })
    .from(pago)
    .innerJoin(paquete, eq(pago.idPaquete, paquete.idPaquete))
    .where(inArray(pago.idPaquete, ids));

  if (conPago.length > 0) {
    throw new AppError(
      409,
      'PAQUETE_CON_PAGO',
      conPago.length === 1
        ? 'No se puede eliminar: el paquete tiene un pago registrado. Elimina el pago primero'
        : `No se puede eliminar: ${conPago.length} paquetes tienen un pago registrado. Elimina sus pagos primero`,
      conPago,
    );
  }

  const borrados = await db.delete(paquete).where(inArray(paquete.idPaquete, ids)).returning({ id: paquete.idPaquete });
  if (borrados.length === 0) throw noEncontrado('Paquete');
  return borrados.length;
}