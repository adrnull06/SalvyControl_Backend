// Validación de lo que llega del frontend (Zod ignora campos desconocidos).
// Reutilizamos nombreUsuario y contrasenaNueva del módulo auth: así las reglas son idénticas
// al crear, al editar y en el script del primer superadmin.
// El rol se envía por NOMBRE ('admin' | 'superadmin'), no por id: no depende del orden del seed.
import { z } from 'zod';
import { busquedaSchema } from '../../utils/validacion.js';
import { contrasenaNueva, nombreUsuario } from '../auth/auth.schemas.js';

const rolSchema = z.enum(['admin', 'superadmin']);

export const crearUsuarioSchema = z
  .object({
    usuario: nombreUsuario,
    contrasena: contrasenaNueva,
    confirmarContrasena: z.string(),
    rol: rolSchema,
  })
  .refine((d) => d.contrasena === d.confirmarContrasena, {
    path: ['confirmarContrasena'],
    message: 'Las contraseñas no coinciden',
  });

// PATCH = parcial. Con `contrasena` (restablecer) debe venir `confirmarContrasena` igual.
export const actualizarUsuarioSchema = z
  .object({
    usuario: nombreUsuario,
    rol: rolSchema,
    estado: z.enum(['activo', 'inactivo']),
    contrasena: contrasenaNueva,
    confirmarContrasena: z.string(),
  })
  .partial()
  .refine(
    (d) => d.usuario !== undefined || d.rol !== undefined || d.estado !== undefined || d.contrasena !== undefined,
    'Envía al menos un campo para actualizar',
  )
  .refine((d) => d.contrasena === undefined || d.contrasena === d.confirmarContrasena, {
    path: ['confirmarContrasena'],
    message: 'Las contraseñas no coinciden',
  });

export const listarUsuariosSchema = z.object({
  filtro: z.enum(['todos', 'activos', 'inactivos']).default('todos'),
  q: busquedaSchema,
});

export type DatosUsuario = z.infer<typeof crearUsuarioSchema>;
export type CambiosUsuario = z.infer<typeof actualizarUsuarioSchema>;
export type ListarUsuarios = z.infer<typeof listarUsuariosSchema>;