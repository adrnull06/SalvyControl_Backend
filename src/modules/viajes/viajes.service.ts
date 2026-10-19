import { and, asc, count, desc, eq, ilike, min, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { estadoViaje, paquete, viaje } from '../../db/schema/index.js';
import { AppError, codigoPg, conflicto, noEncontrado } from '../../utils/errors.js';
import { generarCodigoViaje } from '../../utils/codigos.js';
import { patronBusqueda } from '../../utils/validacion.js';
import type { CambiosViaje, DatosViaje, ListarViajes } from './viajes.schemas.js';

// "Hoy" según El Salvador. El servidor en la nube está en UTC: a las 7 pm en El Salvador
// ya es "mañana" en UTC, y sin esto un viaje cambiaría de estado un día antes.
const HOY = sql`(now() at time zone 'America/El_Salvador')::date`;

const filtroAEstado = { planificado: 'Planificado', en_proceso: 'En proceso', finalizado: 'Finalizado' } as const;

// Los estados viven en una tabla; buscamos su id por nombre (consulta mínima por columna UNIQUE).
async function idEstado(nombre: string) {
  const [e] = await db.select({ id: estadoViaje.id }).from(estadoViaje).where(eq(estadoViaje.nombre, nombre)).limit(1);
  if (!e) throw new Error(`Falta el estado de viaje "${nombre}". Ejecuta: npm run db:seed`);
  return e.id;
}

// Consulta base compartida: viaje + nombre de su estado + cantidad de paquetes asignados.
// COUNT sobre un LEFT JOIN: un viaje sin paquetes devuelve 0 (con INNER JOIN desaparecería).
// El conteo se calcula al consultar, así que NUNCA queda desactualizado.
const columnas = {
  idViaje: viaje.idViaje,
  codigoViaje: viaje.codigoViaje,
  lugarOrigen: viaje.lugarOrigen,
  lugarDestino: viaje.lugarDestino,
  fechaSalida: viaje.fechaSalida,
  fechaLlegada: viaje.fechaLlegada,
  observaciones: viaje.observaciones,
  estado: estadoViaje.nombre,
  fechaFinalizacion: viaje.fechaFinalizacion,
  totalPaquetes: count(paquete.idPaquete),
};

const consultaViajes = (donde?: SQL) =>
  db
    .select(columnas)
    .from(viaje)
    .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
    .leftJoin(paquete, eq(paquete.idViaje, viaje.idViaje))
    .where(donde)
    .groupBy(viaje.idViaje, estadoViaje.id);

export async function listarViajes({ filtro, q }: ListarViajes) {
  const patron = q ? patronBusqueda(q) : null;
  const condiciones = [
    filtro !== 'todos' ? eq(estadoViaje.nombre, filtroAEstado[filtro]) : undefined,
    patron
      ? or(
          ilike(viaje.codigoViaje, patron),
          ilike(viaje.lugarOrigen, patron),
          ilike(viaje.lugarDestino, patron),
          ilike(viaje.observaciones, patron),
        )
      : undefined,
  ];
  // Las tarjetas no se paginan (tu documento solo pide paginación en otras tablas);
  // el límite es una red de seguridad para que la respuesta nunca crezca sin control.
  const datos = await consultaViajes(and(...condiciones))
    .orderBy(desc(viaje.fechaSalida), desc(viaje.idViaje))
    .limit(100);
  return { datos };
}

// Los 3 resúmenes rápidos de la pantalla de Viajes.
export async function resumenViajes() {
  const noFinalizado = ne(estadoViaje.nombre, 'Finalizado');
  const [[activos], [paquetes], [proxima]] = await Promise.all([
    db.select({ total: count() }).from(viaje).innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id)).where(noFinalizado),
    db
      .select({ total: count() })
      .from(paquete)
      .innerJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
      .where(noFinalizado),
    db
      .select({ fecha: min(viaje.fechaSalida) })
      .from(viaje)
      .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
      .where(and(eq(estadoViaje.nombre, 'Planificado'), sql`${viaje.fechaSalida} >= ${HOY}`)),
  ]);
  return {
    viajesActivos: activos?.total ?? 0,
    paquetesEnViajesActivos: paquetes?.total ?? 0,
    proximaSalida: proxima?.fecha ?? null, // null si no hay salidas futuras
  };
}

// Opciones del combo box de "Nuevo paquete": solo viajes Planificados, con la ruta y fechas
// para que la persona elija con información suficiente (no solo un código).
export async function opcionesViajes() {
  const datos = await consultaViajes(eq(estadoViaje.nombre, 'Planificado')).orderBy(asc(viaje.fechaSalida), asc(viaje.idViaje));
  return datos.map((v) => ({
    idViaje: v.idViaje,
    codigoViaje: v.codigoViaje,
    ruta: `${v.lugarOrigen} → ${v.lugarDestino}`,
    fechaSalida: v.fechaSalida,
    fechaLlegada: v.fechaLlegada,
    totalPaquetes: v.totalPaquetes,
  }));
}

// Sugerencias de ciudades ya usadas (autocompletar en el formulario). Evita variantes mal escritas.
export async function ciudadesUsadas() {
  const [origenes, destinos] = await Promise.all([
    db.selectDistinct({ ciudad: viaje.lugarOrigen }).from(viaje),
    db.selectDistinct({ ciudad: viaje.lugarDestino }).from(viaje),
  ]);
  return [...new Set([...origenes, ...destinos].map((r) => r.ciudad))].sort((a, b) => a.localeCompare(b, 'es'));
}

export async function obtenerViaje(id: number) {
  const [v] = await consultaViajes(eq(viaje.idViaje, id)).limit(1);
  if (!v) throw noEncontrado('Viaje');
  return v;
}

export async function crearViaje(datos: DatosViaje) {
  const { estado, ...resto } = datos;
  const idEstadoViaje = await idEstado(estado);

  // El código tiene parte aleatoria; si por casualidad ya existe (error 23505 de la columna UNIQUE),
  // generamos otro y reintentamos. La BD es la garantía real de que no se repita.
  for (let intento = 0; intento < 5; intento++) {
    try {
      const [creado] = await db
        .insert(viaje)
        .values({ ...resto, idEstadoViaje, codigoViaje: generarCodigoViaje(resto.lugarOrigen, resto.lugarDestino) })
        .returning({ id: viaje.idViaje });
      if (!creado) throw new Error('No se pudo crear el viaje');
      return obtenerViaje(creado.id);
    } catch (err) {
      if (codigoPg(err) !== '23505') throw err;
    }
  }
  throw new Error('No se pudo generar un código de viaje único');
}

export async function actualizarViaje(id: number, cambios: CambiosViaje) {
  const actual = await obtenerViaje(id);
  if (actual.estado === 'Finalizado') {
    throw new AppError(409, 'VIAJE_FINALIZADO', 'Un viaje finalizado no se puede modificar');
  }

  // Comparamos fechas con lo que quedará guardado (lo nuevo, o lo que ya había).
  const salida = cambios.fechaSalida ?? actual.fechaSalida;
  const llegada = cambios.fechaLlegada ?? actual.fechaLlegada;
  if (salida && llegada && llegada < salida) {
    throw new AppError(400, 'FECHAS_INVALIDAS', 'La fecha de llegada no puede ser anterior a la de salida');
  }

  // Ojo: codigoViaje NO se toca aunque cambien origen o destino (es un identificador).
  const { estado, ...resto } = cambios;
  await db
    .update(viaje)
    .set({ ...resto, ...(estado ? { idEstadoViaje: await idEstado(estado) } : {}) })
    .where(eq(viaje.idViaje, id));
  return obtenerViaje(id);
}

// Botón "Finalizar": solo desde "En proceso". El WHERE repite la condición para que, si dos
// personas pulsan a la vez, solo una cambie el estado.
export async function finalizarViaje(id: number) {
  const actual = await obtenerViaje(id);
  if (actual.estado !== 'En proceso') {
    throw new AppError(409, 'ESTADO_INVALIDO', 'Solo un viaje "En proceso" puede darse por finalizado');
  }
  const [enProceso, finalizado] = await Promise.all([idEstado('En proceso'), idEstado('Finalizado')]);
  await db
    .update(viaje)
    .set({ idEstadoViaje: finalizado, fechaFinalizacion: new Date() })
    .where(and(eq(viaje.idViaje, id), eq(viaje.idEstadoViaje, enProceso)));
  return obtenerViaje(id);
}

// Un viaje con paquetes no se elimina: la BD los dejaría sin viaje (set null) y se perdería
// su ruta y fechas. Primero hay que reasignar o eliminar esos paquetes.
export async function eliminarViaje(id: number) {
  const v = await obtenerViaje(id);
  if (v.totalPaquetes > 0) {
    throw conflicto(`No se puede eliminar: el viaje ${v.codigoViaje} tiene ${v.totalPaquetes} paquete(s) asignado(s)`);
  }
  await db.delete(viaje).where(eq(viaje.idViaje, id));
}

// Lo ejecuta la tarea programada: pasa a "En proceso" los Planificados cuya fecha de salida
// ya llegó. Es idempotente (correrlo dos veces no daña nada).
export async function iniciarViajesDelDia() {
  const [planificado, enProceso] = await Promise.all([idEstado('Planificado'), idEstado('En proceso')]);
  const movidos = await db
    .update(viaje)
    .set({ idEstadoViaje: enProceso })
    .where(and(eq(viaje.idEstadoViaje, planificado), sql`${viaje.fechaSalida} <= ${HOY}`))
    .returning({ codigo: viaje.codigoViaje });
  return movidos.map((m) => m.codigo);
}