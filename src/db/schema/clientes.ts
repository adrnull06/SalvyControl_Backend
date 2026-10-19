import { pgTable, integer, varchar, timestamp } from 'drizzle-orm/pg-core';

export const cliente = pgTable('cliente', {
  idCliente: integer().primaryKey().generatedAlwaysAsIdentity(),
  nombre: varchar({ length: 100 }).notNull(),
  correo: varchar({ length: 100 }).notNull(),
  telefono: varchar({ length: 30 }).notNull(), 
  direccion: varchar({ length: 150 }).notNull(),
  observaciones: varchar({ length: 255 }),
  fechaRegistro: timestamp({ withTimezone: true }).notNull().defaultNow(),
});