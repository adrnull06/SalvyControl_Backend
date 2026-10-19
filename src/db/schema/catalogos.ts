//Catalogos son listas fijas de opcioens (roles, estados, etc)
import {pgTable, integer, varchar} from 'drizzle-orm/pg-core'

// Misma funcion para no repetir codigo
const columnasCatalogo = () => ({
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: varchar({length: 50}).notNull().unique(),
})

export const rol = pgTable('rol', columnasCatalogo());
export const estadoPaquete = pgTable('estado_paquete', columnasCatalogo());
export const estadoViaje = pgTable('estado_viaje', columnasCatalogo());
export const canalPago = pgTable('canal_pago', columnasCatalogo());
export const metodoPago = pgTable('metodo_pago', columnasCatalogo());
export const metodoEntrega = pgTable('metodo_entrega', columnasCatalogo());