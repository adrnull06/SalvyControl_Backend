// `date` guarda solo la fecha (sin hora), que es lo que necesita un viaje.
// mode 'string' devuelve "2026-10-17" en vez de un objeto Date: evita problemas de zona horaria.
// El check impide que la llegada sea anterior a la salida.
import { pgTable, integer, varchar, date, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { estadoViaje } from './catalogos.js';

export const viaje = pgTable(
  'viaje',
  {
    idViaje: integer().primaryKey().generatedAlwaysAsIdentity(),
    codigoViaje: varchar({ length: 30 }).notNull().unique(),
    lugarOrigen: varchar({ length: 50 }).notNull(),
    lugarDestino: varchar({ length: 50 }).notNull(),
    fechaSalida: date({ mode: 'string' }),
    fechaLlegada: date({ mode: 'string' }),
    idEstadoViaje: integer()
      .notNull()
      .references(() => estadoViaje.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    observaciones: varchar({ length: 150 }),
  },
  (t) => [
    check('viaje_fechas_chk', sql`${t.fechaLlegada} is null or ${t.fechaSalida} is null or ${t.fechaLlegada} >= ${t.fechaSalida}`),
  ],
);