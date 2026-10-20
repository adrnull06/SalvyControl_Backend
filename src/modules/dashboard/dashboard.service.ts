// Resúmenes del dashboard. Todo se CALCULA al consultar (COUNT/SUM): nunca se guarda un total,
// así los números nunca quedan desactualizados.
import { asc, count, desc, eq, sql, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cliente, estadoPaquete, estadoViaje, metodoEntrega, paquete, viaje } from '../../db/schema/index.js';

// Viaje "más reciente" = el que se está operando: primero los NO finalizados, luego por salida
// más reciente. `nulls last` es necesario: en PostgreSQL un DESC pone los NULL primero, y un viaje
// sin fecha ganaría por error. Si solo hay finalizados, devuelve el último de ellos.
async function viajeMasReciente() {
  const [v] = await db
    .select({
      idViaje: viaje.idViaje,
      codigoViaje: viaje.codigoViaje,
      origen: viaje.lugarOrigen,
      destino: viaje.lugarDestino,
      fechaSalida: viaje.fechaSalida,
      fechaLlegada: viaje.fechaLlegada,
      estado: estadoViaje.nombre,
    })
    .from(viaje)
    .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
    .orderBy(sql`(${estadoViaje.nombre} = 'Finalizado') asc`, sql`${viaje.fechaSalida} desc nulls last`, desc(viaje.idViaje))
    .limit(1);
  if (!v) return null; // aún no hay viajes: el frontend muestra "Sin viajes"

  // Totales del viaje y reparto por método de entrega, en paralelo (no dependen entre sí).
  const [[totales], metodos] = await Promise.all([
    db
      .select({ paquetes: count(), libras: sql<string>`coalesce(sum(${paquete.pesoLibras}), 0)` })
      .from(paquete)
      .where(eq(paquete.idViaje, v.idViaje)),
     db
      .select({ metodo: metodoEntrega.nombre, total: count(paquete.idPaquete) })
      .from(metodoEntrega)
      .leftJoin(
        paquete,
        and(eq(paquete.idMetodoEntrega, metodoEntrega.id), eq(paquete.idViaje, v.idViaje)),
      )
      .groupBy(metodoEntrega.id)
      .orderBy(asc(metodoEntrega.id)),
  ]);

  return {
    ...v,
    ruta: `${v.origen} → ${v.destino}`,
    totalPaquetes: totales?.paquetes ?? 0,
    totalLibras: totales?.libras ?? '0', // texto: NUMERIC no pierde precisión
    porMetodoEntrega: metodos,
  };
}

export async function obtenerDashboard() {
  const [totalPaquetes, recientes, filasEstado, viajeReciente] = await Promise.all([
    db.$count(paquete),
    // Los 6 más recientes. El id desempata si dos llegaron en el mismo instante (orden estable).
    db
      .select({
        idPaquete: paquete.idPaquete,
        codigoRastreo: paquete.codigoRastreo,
        clienteNombre: cliente.nombre,
        estado: estadoPaquete.nombre,
        pesoLibras: paquete.pesoLibras,
        codigoViaje: viaje.codigoViaje,
      })
      .from(paquete)
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje)) // LEFT: un paquete sin viaje también aparece
      .orderBy(desc(paquete.fechaHoraRecepcion), desc(paquete.idPaquete))
      .limit(6),
    // Parte de la tabla de ESTADOS (no de paquetes) con LEFT JOIN: así un estado sin paquetes sale con 0
    // y el gráfico siempre tiene las 5 categorías.
    db
      .select({ estado: estadoPaquete.nombre, total: count(paquete.idPaquete) })
      .from(estadoPaquete)
      .leftJoin(paquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .groupBy(estadoPaquete.id)
      .orderBy(asc(estadoPaquete.id)),
    viajeMasReciente(),
  ]);

  // El porcentaje usa la suma de las filas (no `totalPaquetes`) para que el gráfico sea
  // coherente consigo mismo aunque se cree un paquete entre una consulta y otra.
  const suma = filasEstado.reduce((acc, f) => acc + f.total, 0);
  const porEstado = filasEstado.map((f) => ({
    ...f,
    porcentaje: suma > 0 ? Math.round((f.total / suma) * 1000) / 10 : 0,
  }));

  return { totalPaquetes, viajeReciente, recientes, porEstado };
}