// Los dos resúmenes de la pantalla de Reportes. Todo se calcula al consultar (nada se guarda).
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { abono, pago, paquete } from '../../db/schema/index.js';
import { pagadoSql, resumen, totalSql } from '../pagos/pagos.service.js';
import { aCentavos } from './reportes.tipos.js';

export async function resumenReportes() {
  // Mes en curso y anterior, según la hora de El Salvador (date_trunc corta al día 1, 00:00).
  const local = sql`(${abono.fechaPago} at time zone 'America/El_Salvador')`;
  const inicioMes = sql`date_trunc('month', now() at time zone 'America/El_Salvador')`;

  const [[ingresos], [pendiente], sinPago] = await Promise.all([
    db
      .select({
        actual: sql<string>`coalesce(sum(${abono.monto}) filter (where ${local} >= ${inicioMes}), 0)`,
        anterior: sql<string>`coalesce(sum(${abono.monto}) filter (where ${local} >= ${inicioMes} - interval '1 month' and ${local} < ${inicioMes}), 0)`,
      })
      .from(abono),
    // Por cobrar = lo que falta en los pagos Pendientes y Parciales (cobrado < total).
    db
      .select({
        paquetes: sql<number>`count(*)::int`,
        monto: sql<string>`coalesce(sum(${totalSql} - ${pagadoSql}), 0)`,
      })
      .from(pago)
      .leftJoin(resumen, eq(resumen.idPago, pago.idPago))
      .where(sql`${pagadoSql} < ${totalSql}`),
    // Paquetes sin deuda registrada: no se pueden sumar al dinero por cobrar (no hay monto),
    // pero se avisan aparte para que no pasen desapercibidos.
    db.$count(paquete, sql`not exists (select 1 from pago where pago.id_paquete = ${paquete.idPaquete})`),
  ]);

  const actual = aCentavos(ingresos?.actual ?? '0');
  const anterior = aCentavos(ingresos?.anterior ?? '0');
  return {
    ingresosMes: {
      actual: (actual / 100).toFixed(2),
      anterior: (anterior / 100).toFixed(2),
      // Con 0 en el mes anterior el porcentaje no existe (división entre 0): el frontend muestra "-".
      variacionPorcentaje: anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null,
    },
    porCobrar: { monto: pendiente?.monto ?? '0', paquetes: pendiente?.paquetes ?? 0 },
    paquetesSinPago: sinPago,
  };
}