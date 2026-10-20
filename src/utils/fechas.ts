// "Hoy" según El Salvador. El servidor en la nube está en UTC: a las 7 pm en El Salvador ya es
// "mañana" en UTC. Lo movemos aquí porque ahora lo usan Viajes y Paquetes (historial de estados).
import { sql } from 'drizzle-orm';

export const HOY_SV = sql`(now() at time zone 'America/El_Salvador')::date`;