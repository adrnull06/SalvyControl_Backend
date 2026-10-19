// Administradores del sistema. Guardamos solo el HASH de la contraseña, nunca la contraseña.
// `check` hace que la BD misma rechace estados inválidos, aunque alguien se salte la API.
// `restrict`: no se puede borrar un rol que tenga usuarios (protege la integridad).
import { pgTable, integer, varchar, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rol } from './catalogos.js';

export const usuario = pgTable(
  'usuario',
  {
    idUsuario: integer().primaryKey().generatedAlwaysAsIdentity(),
    usuario: varchar({ length: 100 }).notNull().unique(),
    contrasenaHash: varchar({ length: 255 }).notNull(),
    idRol: integer()
      .notNull()
      .references(() => rol.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    estado: varchar({ length: 15 }).notNull().default('activo'),
    fechaCreacion: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('usuario_estado_chk', sql`${t.estado} in ('activo', 'inactivo')`)],
);