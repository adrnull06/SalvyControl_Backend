// Validar con Zod -> llamar al servicio -> responder. Mismo patrón que los demás módulos.
// Los abonos cuelgan del pago (/pagos/:id/abonos) porque no existen sin él.
import { Router } from 'express';
import { autenticar, usuarioActual } from '../../middlewares/auth.js';
import { idSchema } from '../../utils/validacion.js';
import {
  actualizarAbonoSchema, actualizarPagoSchema, crearAbonoSchema,
  crearPagoSchema, eliminarPagosSchema, listarPagosSchema,
} from './pagos.schemas.js';
import {
  actualizarAbono, actualizarPago, crearAbono, crearPago, detallePago,
  eliminarAbono, eliminarPagos, listarPagos,
} from './pagos.service.js';

export const pagosRouter = Router();
pagosRouter.use(autenticar);

pagosRouter.get('/', async (req, res) => {
  res.json(await listarPagos(listarPagosSchema.parse(req.query)));
});
pagosRouter.get('/:id', async (req, res) => {
  res.json({ pago: await detallePago(idSchema.parse(req.params.id)) });
});

pagosRouter.post('/', async (req, res) => {
  const pago = await crearPago(crearPagoSchema.parse(req.body), usuarioActual(req).id);
  res.status(201).json({ pago, mensaje: 'Pago registrado correctamente' });
});
pagosRouter.patch('/:id', async (req, res) => {
  const pago = await actualizarPago(idSchema.parse(req.params.id), actualizarPagoSchema.parse(req.body));
  res.json({ pago, mensaje: 'Pago actualizado correctamente' });
});

pagosRouter.post('/:id/abonos', async (req, res) => {
  const pago = await crearAbono(idSchema.parse(req.params.id), crearAbonoSchema.parse(req.body), usuarioActual(req).id);
  res.status(201).json({ pago, mensaje: 'Abono registrado correctamente' });
});
pagosRouter.patch('/:id/abonos/:idAbono', async (req, res) => {
  const pago = await actualizarAbono(
    idSchema.parse(req.params.id),
    idSchema.parse(req.params.idAbono),
    actualizarAbonoSchema.parse(req.body),
  );
  res.json({ pago, mensaje: 'Abono actualizado correctamente' });
});
pagosRouter.delete('/:id/abonos/:idAbono', async (req, res) => {
  const pago = await eliminarAbono(idSchema.parse(req.params.id), idSchema.parse(req.params.idAbono));
  res.json({ pago, mensaje: 'Abono eliminado correctamente' });
});

pagosRouter.post('/eliminar-multiple', async (req, res) => {
  const eliminados = await eliminarPagos(eliminarPagosSchema.parse(req.body).ids);
  res.json({ eliminados, mensaje: `${eliminados} pago(s) eliminado(s)` });
});
pagosRouter.delete('/:id', async (req, res) => {
  await eliminarPagos([idSchema.parse(req.params.id)]);
  res.json({ mensaje: 'Pago eliminado correctamente' });
});