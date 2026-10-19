import { pgTable, integer, numeric, timestamp, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { paquete } from './paquetes.js';
import { usuario } from './usuarios.js';
import { canalPago, metodoPago } from './catalogos.js';

export const pago = pgTable(
  'pago',
  {
    idPago: integer().primaryKey().generatedAlwaysAsIdentity(),
    idPaquete: integer().notNull().unique().references(() => paquete.idPaquete, { onUpdate: 'cascade', onDelete: 'restrict' }),
    costoServicio: numeric({ precision: 10, scale: 2 }).notNull(),
    costoCompra: numeric({ precision: 10, scale: 2 }).notNull().default('0'),
    idCanalPago: integer().notNull().references(() => canalPago.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    idMetodoPago: integer().notNull().references(() => metodoPago.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    fechaCreacion: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('pago_costos_chk', sql`${t.costoServicio} >= 0 and ${t.costoCompra} >= 0`),
    check('pago_total_chk', sql`${t.costoServicio} + ${t.costoCompra} > 0`),
  ],
);

export const abono = pgTable(
  'abono',
  {
    idAbono: integer().primaryKey().generatedAlwaysAsIdentity(),
    idPago: integer().notNull().references(() => pago.idPago, { onUpdate: 'cascade', onDelete: 'cascade' }),
    monto: numeric({ precision: 10, scale: 2 }).notNull(),
    fechaPago: timestamp({ withTimezone: true }).notNull().defaultNow(), // editable para correcciones
    idCanalPago: integer().notNull().references(() => canalPago.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    idMetodoPago: integer().notNull().references(() => metodoPago.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    idUsuario: integer().notNull().references(() => usuario.idUsuario, { onUpdate: 'cascade', onDelete: 'restrict' }),
  },
  (t) => [check('abono_monto_chk', sql`${t.monto} > 0`), index('idx_abono_pago').on(t.idPago)],
);