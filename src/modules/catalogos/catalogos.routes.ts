// Una sola llamada entrega todas las listas de los combo box (estados, métodos...), con su id.
// El frontend manda esos ids al crear o editar. Se ordenan por id: el orden del seed
// (Recibido, En tránsito, En aduana...) coincide con el flujo real del paquete.
import { Router } from 'express';
import { asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { autenticar } from '../../middlewares/auth.js';
import { canalPago, estadoPaquete, estadoViaje, metodoEntrega, metodoPago } from '../../db/schema/index.js';

export const catalogosRouter = Router();
catalogosRouter.use(autenticar);

catalogosRouter.get('/', async (_req, res) => {
  const [estadosPaquete, estadosViaje, metodosEntrega, canalesPago, metodosPago] = await Promise.all([
    db.select().from(estadoPaquete).orderBy(asc(estadoPaquete.id)),
    db.select().from(estadoViaje).orderBy(asc(estadoViaje.id)),
    db.select().from(metodoEntrega).orderBy(asc(metodoEntrega.id)),
    db.select().from(canalPago).orderBy(asc(canalPago.id)),
    db.select().from(metodoPago).orderBy(asc(metodoPago.id)),
  ]);
  res.json({ estadosPaquete, estadosViaje, metodosEntrega, canalesPago, metodosPago });
});