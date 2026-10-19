// Datos iniciales que el sistema necesita para funcionar (si estas listas están vacías,
// no se puede ni crear un paquete). `onConflictDoNothing` lo hace seguro de ejecutar
// varias veces: si el dato ya existe, lo omite en vez de fallar o duplicarlo.
// El ORDEN importa: los ids se asignan 1, 2, 3... según el orden en que aparecen aquí.
import { db, pool } from './client.js';
import { rol, estadoPaquete, estadoViaje, canalPago, metodoPago, metodoEntrega } from './schema/index.js';

const nombres = (...lista: string[]) => lista.map((nombre) => ({ nombre }));

await db.insert(rol).values(nombres('admin', 'superadmin')).onConflictDoNothing();
await db.insert(estadoPaquete).values(nombres('Recibido', 'En tránsito', 'En aduana', 'Listo para entregar', 'Entregado')).onConflictDoNothing();
await db.insert(estadoViaje).values(nombres('Planificado', 'En proceso', 'Finalizado')).onConflictDoNothing();
await db.insert(canalPago).values(nombres('Por definir', 'En línea', 'Oficinas', 'Domicilio / Contra entrega')).onConflictDoNothing();
await db.insert(metodoPago).values(nombres('Por definir', 'Transferencia', 'Tarjeta', 'Efectivo')).onConflictDoNothing();
await db.insert(metodoEntrega).values(nombres('Por definir', 'Envío a domicilio', 'Entrega a casa directa', 'Cliente recogerá', 'Otros')).onConflictDoNothing();

console.log('Datos semilla insertados');
await pool.end(); // cierra la conexión para que el script termine