// NUMERIC se usa para dinero y peso porque no tiene errores de redondeo (FLOAT sí los tiene).
// `set null` en id_viaje: si se borra un viaje, sus paquetes NO se borran, solo quedan sin viaje.
// `cascade` en historial: si se borra un paquete, su historial se va con él.
// La restricción única (paquete, estado, día) impide registrar el mismo estado dos veces el mismo día.
import { pgTable, integer, varchar, numeric, timestamp, date, check, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { cliente } from './clientes.js';
import { viaje } from './viajes.js';
import { usuario } from './usuarios.js';
import { estadoPaquete, metodoEntrega } from './catalogos.js';

export const paquete = pgTable(
    'paquete',
    {
        idPaquete: integer().primaryKey().generatedAlwaysAsIdentity(),
        idCliente: integer().notNull().references(() => cliente.idCliente, { onUpdate: 'cascade', onDelete: 'restrict' }),
        idViaje: integer().references(() => viaje.idViaje, { onUpdate: 'cascade', onDelete: 'set null' }),
        codigoRastreo: varchar({ length: 16 }).notNull().unique(),
        tiendaProcedencia: varchar({ length: 100 }),
        descripcion: varchar({ length: 255 }),
        observaciones: varchar({ length: 255 }),
        pesoLibras: numeric({ precision: 8, scale: 2 }).notNull(),
        idMetodoEntrega: integer().notNull().references(() => metodoEntrega.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
        lugarEntrega: varchar({ length: 150 }),
        fechaHoraRecepcion: timestamp({ withTimezone: true }).notNull().defaultNow(),
        idEstadoActual: integer().notNull().references(() => estadoPaquete.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    },
    (t) => [
        check('paquete_peso_chk', sql`${t.pesoLibras} > 0`),
        index('idx_paquete_viaje').on(t.idViaje),
        index('idx_paquete_cliente').on(t.idCliente),
    ],
);

// Cada cambio de estado deja una fila: qué estado, cuándo y QUIÉN lo hizo.
// De aquí sale la fecha de cada estado que verá el público en el rastreo.
export const historialEstado = pgTable(
    'historial_estado',
    {
        idHistorial: integer().primaryKey().generatedAlwaysAsIdentity(),
        idPaquete: integer().notNull().references(() => paquete.idPaquete, { onUpdate: 'cascade', onDelete: 'cascade' }),
        idEstado: integer().notNull().references(() => estadoPaquete.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
        idUsuario: integer().notNull().references(() => usuario.idUsuario, { onUpdate: 'cascade', onDelete: 'restrict' }),
        fechaCambio: timestamp({ withTimezone: true }).notNull().defaultNow(),
        fechaCambioEstado: date({ mode: 'string' }).notNull().defaultNow(),
    },
    (t) => [unique('uk_paquete_estado_fecha').on(t.idPaquete, t.idEstado, t.fechaCambioEstado)],
);