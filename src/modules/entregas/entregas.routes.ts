// Validar con Zod -> llamar al servicio -> responder. `usuarioActual` queda en el historial
// como quien entregó (auditoría).
import { Router } from 'express';
import { autenticar, usuarioActual } from '../../middlewares/auth.js';
import { completarEntregasSchema, listarEntregasSchema } from './entregas.schemas.js';
import { completarEntregas, listarEntregas } from './entregas.service.js';

export const entregasRouter = Router();
entregasRouter.use(autenticar);

entregasRouter.get('/', async (req, res) => {
  res.json(await listarEntregas(listarEntregasSchema.parse(req.query)));
});

// Sirve para 1 o varios paquetes (botón individual o selección múltiple).
entregasRouter.post('/completar', async (req, res) => {
  const { ids } = completarEntregasSchema.parse(req.body);
  const r = await completarEntregas(ids, usuarioActual(req).id);
  const omitidos = r.noElegibles > 0 ? `; ${r.noElegibles} omitido(s) por no estar listos para entrega` : '';
  res.json({ ...r, mensaje: `${r.cambiados} entrega(s) completada(s)${omitidos}` });
});