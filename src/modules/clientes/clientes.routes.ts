// Cada handler hace 3 cosas: validar con Zod -> llamar al servicio -> responder.
// Toda la sección exige sesión (autenticar); admin y superadmin pueden usarla.
// Las respuestas de crear/editar/eliminar incluyen `mensaje` para la retroalimentación
// de éxito que pide tu documento; los errores ya salen con formato claro del manejador central.
import { Router } from 'express';
import { autenticar } from '../../middlewares/auth.js';
import { idSchema } from '../../utils/validacion.js';
import {
  actualizarClienteSchema,
  crearClienteSchema,
  eliminarClientesSchema,
  listarClientesSchema,
} from './clientes.schemas.js';
import {
  actualizarCliente,
  crearCliente,
  eliminarClientes,
  listarClientes,
  obtenerCliente,
} from './clientes.service.js';

export const clientesRouter = Router();
clientesRouter.use(autenticar);

// GET /api/clientes?pagina=1&q=ana&orden=recientes
clientesRouter.get('/', async (req, res) => {
  res.json(await listarClientes(listarClientesSchema.parse(req.query)));
});

clientesRouter.get('/:id', async (req, res) => {
  res.json({ cliente: await obtenerCliente(idSchema.parse(req.params.id)) });
});

clientesRouter.post('/', async (req, res) => {
  const cliente = await crearCliente(crearClienteSchema.parse(req.body));
  res.status(201).json({ cliente, mensaje: 'Cliente creado correctamente' });
});

clientesRouter.patch('/:id', async (req, res) => {
  const cliente = await actualizarCliente(idSchema.parse(req.params.id), actualizarClienteSchema.parse(req.body));
  res.json({ cliente, mensaje: 'Cliente actualizado correctamente' });
});

// Eliminación múltiple. Es POST y no DELETE porque algunos navegadores/proxys ignoran el
// cuerpo de un DELETE; esta ruta no choca con /:id porque tiene otro método y otra ruta.
clientesRouter.post('/eliminar-multiple', async (req, res) => {
  const { ids } = eliminarClientesSchema.parse(req.body);
  const eliminados = await eliminarClientes(ids);
  res.json({ eliminados, mensaje: `${eliminados} cliente(s) eliminado(s)` });
});

clientesRouter.delete('/:id', async (req, res) => {
  await eliminarClientes([idSchema.parse(req.params.id)]);
  res.json({ mensaje: 'Cliente eliminado correctamente' });
});