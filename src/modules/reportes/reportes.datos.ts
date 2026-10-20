// Construye los datos de cada reporte con consultas SQL. Las fechas se comparan en HORA DE EL
// SALVADOR: el servidor está en UTC y sin esto un abono de las 11:30 pm caería en el día siguiente.
// Cada consulta pide MAX_FILAS + 1: si llega la fila extra, el reporte es demasiado grande y se
// rechaza, en vez de cargar miles de filas en memoria.
import { asc, between, count, eq, sql, type AnyColumn } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  abono, canalPago, cliente, estadoPaquete, estadoViaje, metodoEntrega, metodoPago, paquete, pago, usuario, viaje,
} from '../../db/schema/index.js';
import { AppError } from '../../utils/errors.js';
import { aCentavos, fechaUS, lb, usd, type Reporte } from './reportes.tipos.js';
import type { TipoReporte } from './reportes.schemas.js';

const MAX_FILAS = 5000;

const limitar = <T>(filas: T[]) => {
  if (filas.length > MAX_FILAS)
    throw new AppError(400, 'REPORTE_MUY_GRANDE', `El reporte supera ${MAX_FILAS} filas. Elige un rango de fechas más corto`);
  return filas;
};

// Día (en El Salvador) de una columna de fecha y hora, comparado con el rango, ambos extremos incluidos.
const enRango = (col: AnyColumn, desde: string, hasta: string) =>
  sql`(${col} at time zone 'America/El_Salvador')::date between ${desde} and ${hasta}`;

const fechaHoraSV = (col: AnyColumn) =>
  sql<string>`to_char(${col} at time zone 'America/El_Salvador', 'MM/DD/YYYY HH24:MI')`;

const sumar = <K>(m: Map<K, number>, k: K, v: number) => m.set(k, (m.get(k) ?? 0) + v);

async function financiero(desde: string, hasta: string): Promise<Reporte> {
  const filas = limitar(
    await db
      .select({
        fecha: fechaHoraSV(abono.fechaPago),
        codigo: paquete.codigoRastreo,
        cliente: cliente.nombre,
        monto: abono.monto,
        canal: canalPago.nombre,
        metodo: metodoPago.nombre,
        registradoPor: usuario.usuario,
      })
      .from(abono)
      .innerJoin(pago, eq(abono.idPago, pago.idPago))
      .innerJoin(paquete, eq(pago.idPaquete, paquete.idPaquete))
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(canalPago, eq(abono.idCanalPago, canalPago.id))
      .innerJoin(metodoPago, eq(abono.idMetodoPago, metodoPago.id))
      .innerJoin(usuario, eq(abono.idUsuario, usuario.idUsuario))
      .where(enRango(abono.fechaPago, desde, hasta))
      .orderBy(asc(abono.fechaPago), asc(abono.idAbono))
      .limit(MAX_FILAS + 1),
  );

  // Totales calculados con las MISMAS filas que se muestran: el resumen y la tabla siempre coinciden.
  let total = 0;
  const porMetodo = new Map<string, number>();
  for (const f of filas) {
    const c = aCentavos(f.monto);
    total += c;
    sumar(porMetodo, f.metodo, c);
  }
  return {
    titulo: 'Reporte financiero: ingresos y abonos',
    desde,
    hasta,
    resumen: [
      { etiqueta: 'Total cobrado', valor: usd(total) },
      { etiqueta: 'Abonos registrados', valor: String(filas.length) },
      ...[...porMetodo].map(([m, c]) => ({ etiqueta: `Cobrado por ${m}`, valor: usd(c) })),
    ],
    columnas: [
      { clave: 'fecha', titulo: 'Fecha y hora', ancho: 18, tipo: 'texto' },
      { clave: 'codigo', titulo: 'Paquete', ancho: 14, tipo: 'texto' },
      { clave: 'cliente', titulo: 'Cliente', ancho: 26, tipo: 'texto' },
      { clave: 'monto', titulo: 'Monto', ancho: 12, tipo: 'dinero' },
      { clave: 'canal', titulo: 'Canal', ancho: 24, tipo: 'texto' },
      { clave: 'metodo', titulo: 'Método', ancho: 14, tipo: 'texto' },
      { clave: 'registradoPor', titulo: 'Registrado por', ancho: 16, tipo: 'texto' },
    ],
    filas,
  };
}

async function paquetes(desde: string, hasta: string): Promise<Reporte> {
  const filas = limitar(
    await db
      .select({
        fecha: fechaHoraSV(paquete.fechaHoraRecepcion),
        codigo: paquete.codigoRastreo,
        cliente: cliente.nombre,
        tienda: paquete.tiendaProcedencia,
        peso: paquete.pesoLibras,
        idEstado: estadoPaquete.id,
        estado: estadoPaquete.nombre,
        viaje: viaje.codigoViaje,
        entrega: metodoEntrega.nombre,
      })
      .from(paquete)
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .innerJoin(metodoEntrega, eq(paquete.idMetodoEntrega, metodoEntrega.id))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .where(enRango(paquete.fechaHoraRecepcion, desde, hasta))
      .orderBy(asc(paquete.fechaHoraRecepcion), asc(paquete.idPaquete))
      .limit(MAX_FILAS + 1),
  );

  let libras = 0;
  const porEstado = new Map<number, { nombre: string; n: number }>();
  for (const f of filas) {
    libras += aCentavos(f.peso);
    const e = porEstado.get(f.idEstado) ?? { nombre: f.estado, n: 0 };
    e.n += 1;
    porEstado.set(f.idEstado, e);
  }
  return {
    titulo: 'Reporte de paquetes recibidos',
    desde,
    hasta,
    resumen: [
      { etiqueta: 'Paquetes recibidos', valor: String(filas.length) },
      { etiqueta: 'Libras totales', valor: lb(libras) },
      // En el orden del flujo (por id de estado): Recibido, En tránsito, En aduana...
      ...[...porEstado].sort((a, b) => a[0] - b[0]).map(([, e]) => ({ etiqueta: `Estado actual: ${e.nombre}`, valor: String(e.n) })),
    ],
    columnas: [
      { clave: 'fecha', titulo: 'Recepción', ancho: 18, tipo: 'texto' },
      { clave: 'codigo', titulo: 'Código', ancho: 14, tipo: 'texto' },
      { clave: 'cliente', titulo: 'Cliente', ancho: 24, tipo: 'texto' },
      { clave: 'tienda', titulo: 'Procedencia', ancho: 18, tipo: 'texto' },
      { clave: 'peso', titulo: 'Libras', ancho: 9, tipo: 'libras' },
      { clave: 'estado', titulo: 'Estado', ancho: 18, tipo: 'texto' },
      { clave: 'viaje', titulo: 'Viaje', ancho: 18, tipo: 'texto' },
      { clave: 'entrega', titulo: 'Entrega', ancho: 20, tipo: 'texto' },
    ],
    filas: filas.map(({ idEstado: _id, ...resto }) => resto), // el id solo sirvió para ordenar el resumen
  };
}

async function viajes(desde: string, hasta: string): Promise<Reporte> {
  const datos = limitar(
    await db
      .select({
        codigo: viaje.codigoViaje,
        // Guion y no flecha: la fuente estándar del PDF no tiene "→".
        ruta: sql<string>`${viaje.lugarOrigen} || ' - ' || ${viaje.lugarDestino}`,
        estado: estadoViaje.nombre,
        salida: viaje.fechaSalida,
        llegada: viaje.fechaLlegada,
        paquetes: count(paquete.idPaquete),
        libras: sql<string>`coalesce(sum(${paquete.pesoLibras}), 0)`,
      })
      .from(viaje)
      .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
      .leftJoin(paquete, eq(paquete.idViaje, viaje.idViaje)) // LEFT: un viaje sin paquetes también sale
      .where(between(viaje.fechaSalida, desde, hasta))
      .groupBy(viaje.idViaje, estadoViaje.id)
      .orderBy(asc(viaje.fechaSalida), asc(viaje.idViaje))
      .limit(MAX_FILAS + 1),
  );

  let libras = 0;
  let totalPaquetes = 0;
  for (const v of datos) {
    libras += aCentavos(v.libras);
    totalPaquetes += v.paquetes;
  }
  return {
    titulo: 'Reporte de viajes',
    desde,
    hasta,
    resumen: [
      { etiqueta: 'Viajes', valor: String(datos.length) },
      { etiqueta: 'Paquetes transportados', valor: String(totalPaquetes) },
      { etiqueta: 'Libras totales', valor: lb(libras) },
    ],
    columnas: [
      { clave: 'codigo', titulo: 'Código', ancho: 20, tipo: 'texto' },
      { clave: 'ruta', titulo: 'Ruta', ancho: 34, tipo: 'texto' },
      { clave: 'estado', titulo: 'Estado', ancho: 14, tipo: 'texto' },
      { clave: 'salida', titulo: 'Salida', ancho: 12, tipo: 'texto' },
      { clave: 'llegada', titulo: 'Llegada est.', ancho: 12, tipo: 'texto' },
      { clave: 'paquetes', titulo: 'Paquetes', ancho: 10, tipo: 'entero' },
      { clave: 'libras', titulo: 'Libras', ancho: 10, tipo: 'libras' },
    ],
    filas: datos.map((v) => ({ ...v, salida: fechaUS(v.salida), llegada: fechaUS(v.llegada) })),
  };
}

const constructores = { financiero, paquetes, viajes };
export const construirReporte = (tipo: TipoReporte, desde: string, hasta: string) =>
  constructores[tipo](desde, hasta);