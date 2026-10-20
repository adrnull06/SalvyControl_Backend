import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cliente, estadoPaquete, metodoEntrega, pago, paquete, viaje } from '../../db/schema/index.js';
import { AppError } from '../../utils/errors.js';
import { HOY_SV } from '../../utils/fechas.js';
import { POR_PAGINA, armarPaginacion, patronBusqueda } from '../../utils/validacion.js';
import { estadoSql, pagadoSql, resumen, totalSql } from '../pagos/pagos.service.js';
import { cambiarEstado } from '../paquetes/paquetes.service.js';
import type { ListarEntregas } from './entregas.schemas.js';
import { filtroTexto } from '../../utils/busqueda.js';

// Si el paquete no tiene pago, el estado de pago "calculado" diría "Pendiente" (suma 0),
// pero eso sería engañoso: no hay deuda registrada. Lo distinguimos con "Sin pago".
const sinPago = sql`${pago.idPago} is null`;
const estadoCobro = sql<'Sin pago' | 'Pendiente' | 'Parcial' | 'Pagado'>`case when ${sinPago} then 'Sin pago' else ${estadoSql} end`;

// Cuándo se entregó: el último registro del historial con el estado ACTUAL del paquete,
// y solo si ese estado es "Entregado". Se formatea en ISO UTC (igual que en Pagos).
const fechaEntrega = sql<string | null>`case when ${estadoPaquete.nombre} = 'Entregado' then (
  select to_char(max(h.fecha_cambio) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  from historial_estado h
  where h.id_paquete = ${paquete.idPaquete} and h.id_estado = ${paquete.idEstadoActual}
) end`;

const columnas = {
  idPaquete: paquete.idPaquete,
  codigoRastreo: paquete.codigoRastreo,
  clienteNombre: cliente.nombre,
  clienteTelefono: cliente.telefono,
  clienteCorreo: cliente.correo,
  direccionDestino: sql<string>`coalesce(${paquete.lugarEntrega}, ${cliente.direccion})`,
  observaciones: paquete.observaciones,
  metodoEntrega: metodoEntrega.nombre,
  idEstado: paquete.idEstadoActual,
  estado: estadoPaquete.nombre,
  codigoViaje: viaje.codigoViaje,
  estadoCobro,
  total: sql<string | null>`case when ${sinPago} then null else ${totalSql} end`,
  montoPagado: sql<string | null>`case when ${sinPago} then null else ${pagadoSql} end`,
  // OJO: greatest() ignora los NULL, por eso el `case`: sin pago, el saldo es null y no 0.
  saldoPendiente: sql<string | null>`case when ${sinPago} then null else greatest(${totalSql} - ${pagadoSql}, 0) end`,
  fechaEntrega,
};

export async function listarEntregas({ pagina, q, filtro }: ListarEntregas) {
  const donde = and(
    // "Todas" = los Listos para entregar + los Entregados en los últimos 30 días.
    filtro === 'todas'
      ? or(
          eq(estadoPaquete.nombre, 'Listo para entregar'),
          sql`${estadoPaquete.nombre} = 'Entregado' and exists (
            select 1 from historial_estado h
            where h.id_paquete = ${paquete.idPaquete}
              and h.id_estado = ${paquete.idEstadoActual}
              and h.fecha_cambio >= now() - interval '30 days')`,
        )
      : undefined,
    // "Listas" = solo los que esperan ser entregados.
    filtro === 'listas' ? eq(estadoPaquete.nombre, 'Listo para entregar') : undefined,
    // "Hoy" según El Salvador, mirando el historial (no una columna en el paquete).
    filtro === 'hoy'
      ? sql`${estadoPaquete.nombre} = 'Entregado' and exists (
          select 1 from historial_estado h
          where h.id_paquete = ${paquete.idPaquete}
            and h.id_estado = ${paquete.idEstadoActual}
            and h.fecha_cambio_estado = ${HOY_SV})`
      : undefined,
    filtroTexto(
      q,
      [
        paquete.codigoRastreo,
        viaje.codigoViaje,
        cliente.nombre,
        cliente.correo,
        cliente.direccion,
        paquete.lugarEntrega,
        paquete.observaciones,
        metodoEntrega.nombre,
        estadoCobro,
      ],
      [cliente.telefono],
    ),
  );

  // Los dos SELECT llevan los MISMOS joins: si difirieran, "Mostrando x de y" no coincidiría con la lista.
  const [[conteo], datos] = await Promise.all([
    db
      .select({ total: count() })
      .from(paquete)
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .innerJoin(metodoEntrega, eq(paquete.idMetodoEntrega, metodoEntrega.id))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .leftJoin(pago, eq(pago.idPaquete, paquete.idPaquete))
      .leftJoin(resumen, eq(resumen.idPago, pago.idPago))
      .where(donde),
    db
      .select(columnas)
      .from(paquete)
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .innerJoin(metodoEntrega, eq(paquete.idMetodoEntrega, metodoEntrega.id))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .leftJoin(pago, eq(pago.idPaquete, paquete.idPaquete))
      .leftJoin(resumen, eq(resumen.idPago, pago.idPago))
      .where(donde)
      .orderBy(desc(paquete.fechaHoraRecepcion), desc(paquete.idPaquete))
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
  ]);
  return { datos, paginacion: armarPaginacion(pagina, conteo?.total ?? 0) };
}
// Busca el id de un estado por su nombre (los ids vienen del seed, pero el nombre es lo estable).
async function idEstadoPaquete(nombre: string) {
  const [e] = await db.select({ id: estadoPaquete.id }).from(estadoPaquete).where(eq(estadoPaquete.nombre, nombre)).limit(1);
  if (!e) throw new Error(`Falta el estado "${nombre}". Ejecuta: npm run db:seed`);
  return e.id;
}

// Marca como entregados los paquetes seleccionados que estén "Listo para entregar".
export async function completarEntregas(ids: number[], idUsuario: number) {
  const [listo, entregado] = await Promise.all([idEstadoPaquete('Listo para entregar'), idEstadoPaquete('Entregado')]);
  const r = await cambiarEstado(ids, entregado, idUsuario, listo);
  // Si NO se pudo completar ninguno por no estar listos, es un error para el usuario, no un "éxito con 0".
  if (r.cambiados === 0 && r.noElegibles > 0) {
    throw new AppError(409, 'NO_ELEGIBLES', 'Solo se pueden completar paquetes en estado "Listo para entregar"', r);
  }
  return r;
}