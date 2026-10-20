// Todo el módulo exige sesión Y rol superadmin (los admin reciben 403). Sin DELETE a propósito:
// los usuarios solo se desactivan, porque historial_estado y abono apuntan a ellos (auditoría).
import { Router } from 'express';
import { autenticar, requerirRol, usuarioActual } from '../../middlewares/auth.js';
import { idSchema } from '../../utils/validacion.js';
import { actualizarUsuarioSchema, crearUsuarioSchema, listarUsuariosSchema } from './usuarios.schemas.js';
import { actualizarUsuario, crearUsuario, listarUsuarios, obtenerUsuario } from './usuarios.service.js';

export const usuariosRouter = Router();
usuariosRouter.use(autenticar, requerirRol('superadmin'));

usuariosRouter.get('/', async (req, res) => {
  res.json(await listarUsuarios(listarUsuariosSchema.parse(req.query)));
});
usuariosRouter.get('/:id', async (req, res) => {
  res.json({ usuario: await obtenerUsuario(idSchema.parse(req.params.id)) });
});
usuariosRouter.post('/', async (req, res) => {
  const usuario = await crearUsuario(crearUsuarioSchema.parse(req.body), usuarioActual(req).id);
  res.status(201).json({ usuario, mensaje: `Usuario "${usuario.usuario}" creado correctamente` });
});
usuariosRouter.patch('/:id', async (req, res) => {
  const usuario = await actualizarUsuario(
    idSchema.parse(req.params.id),
    actualizarUsuarioSchema.parse(req.body),
    usuarioActual(req).id,
  );
  res.json({ usuario, mensaje: 'Usuario actualizado correctamente' });
});