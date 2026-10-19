// Validar con Zod -> llamar al servicio -> responder. Mismo patrón que Clientes.
// Las rutas fijas (/resumen, /opciones, /ciudades) van ANTES de /:id; si no, Express
// interpretaría "resumen" como un id.
import { Router } from 'express';
import { autenticar } from '../../middlewares/auth.js';
import { idSchema } from '../../utils/validacion.js';
import { actualizarViajeSchema, crearViajeSchema, listarViajesSchema } from './viajes.schemas.js';
import {
  actualizarViaje,
  ciudadesUsadas,
  crearViaje,
  eliminarViaje,
  finalizarViaje,
  listarViajes,
  obtenerViaje,
  opcionesViajes,
  resumenViajes,
} from './viajes.service.js';

export const viajesRouter = Router();
viajesRouter.use(autenticar);

viajesRouter.get('/', async (req, res) => {
  res.json(await listarViajes(listarViajesSchema.parse(req.query)));
});
viajesRouter.get('/resumen', async (_req, res) => {
  res.json(await resumenViajes());
});
viajesRouter.get('/opciones', async (_req, res) => {
  res.json({ datos: await opcionesViajes() });
});
viajesRouter.get('/ciudades', async (_req, res) => {
  res.json({ datos: await ciudadesUsadas() });
});
viajesRouter.get('/:id', async (req, res) => {
  res.json({ viaje: await obtenerViaje(idSchema.parse(req.params.id)) });
});

viajesRouter.post('/', async (req, res) => {
  const viaje = await crearViaje(crearViajeSchema.parse(req.body));
  res.status(201).json({ viaje, mensaje: `Viaje ${viaje.codigoViaje} creado correctamente` });
});
viajesRouter.patch('/:id', async (req, res) => {
  const viaje = await actualizarViaje(idSchema.parse(req.params.id), actualizarViajeSchema.parse(req.body));
  res.json({ viaje, mensaje: 'Viaje actualizado correctamente' });
});
viajesRouter.post('/:id/finalizar', async (req, res) => {
  const viaje = await finalizarViaje(idSchema.parse(req.params.id));
  res.json({ viaje, mensaje: `Viaje ${viaje.codigoViaje} finalizado` });
});
viajesRouter.delete('/:id', async (req, res) => {
  await eliminarViaje(idSchema.parse(req.params.id));
  res.json({ mensaje: 'Viaje eliminado correctamente' });
});