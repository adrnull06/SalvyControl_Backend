// Validar con Zod -> llamar al servicio -> responder. Las rutas fijas (/opciones) van antes de /:id.
// `usuarioActual(req).id` es quién hizo el cambio: se guarda en el historial para auditar.
import { Router } from 'express';
import { autenticar, usuarioActual } from '../../middlewares/auth.js';
import { idSchema } from '../../utils/validacion.js';
import {
  actualizarPaqueteSchema, cambiarEstadoSchema, crearPaqueteSchema,
  eliminarPaquetesSchema, listarPaquetesSchema, opcionesPaquetesSchema,
} from './paquetes.schemas.js';
import {
  actualizarPaquete, cambiarEstado, crearPaquete, detallePaquete,
  eliminarPaquetes, listarPaquetes, opcionesPaquetes,
} from './paquetes.service.js';

export const paquetesRouter = Router();
paquetesRouter.use(autenticar);

paquetesRouter.get('/', async (req, res) => {
  res.json(await listarPaquetes(listarPaquetesSchema.parse(req.query)));
});
paquetesRouter.get('/opciones', async (req, res) => {
  res.json({ datos: await opcionesPaquetes(opcionesPaquetesSchema.parse(req.query).q) });
});
paquetesRouter.get('/:id', async (req, res) => {
  res.json({ paquete: await detallePaquete(idSchema.parse(req.params.id)) });
});

paquetesRouter.post('/', async (req, res) => {
  const paquete = await crearPaquete(crearPaqueteSchema.parse(req.body), usuarioActual(req).id);
  res.status(201).json({ paquete, mensaje: `Paquete ${paquete.codigoRastreo} creado correctamente` });
});
paquetesRouter.patch('/:id', async (req, res) => {
  const paquete = await actualizarPaquete(idSchema.parse(req.params.id), actualizarPaqueteSchema.parse(req.body));
  res.json({ paquete, mensaje: 'Paquete actualizado correctamente' });
});

// Sirve para 1 o varios paquetes (selección múltiple o botón individual).
paquetesRouter.post('/cambiar-estado', async (req, res) => {
  const { ids, idEstado } = cambiarEstadoSchema.parse(req.body);
  const resultado = await cambiarEstado(ids, idEstado, usuarioActual(req).id);
  res.json({ ...resultado, mensaje: `${resultado.cambiados} paquete(s) actualizado(s)` });
});

paquetesRouter.post('/eliminar-multiple', async (req, res) => {
  const eliminados = await eliminarPaquetes(eliminarPaquetesSchema.parse(req.body).ids);
  res.json({ eliminados, mensaje: `${eliminados} paquete(s) eliminado(s)` });
});
paquetesRouter.delete('/:id', async (req, res) => {
  await eliminarPaquetes([idSchema.parse(req.params.id)]);
  res.json({ mensaje: 'Paquete eliminado correctamente' });
});