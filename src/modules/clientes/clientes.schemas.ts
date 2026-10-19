// Validación de lo que llega del frontend. Zod ELIMINA los campos desconocidos: si alguien
// envía { idCliente: 1 } o { fechaRegistro: ... } en el cuerpo, se ignoran (evita "mass assignment").
// Los textos se limpian (trim) y el correo se guarda en minúsculas para que "ANA@x.com" y
// "ana@x.com" sean el mismo y la búsqueda/enlace por correo funcione siempre.
import { z } from 'zod';
import { busquedaSchema, idsSchema, paginaSchema } from '../../utils/validacion.js';

const clienteBase = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  correo: z.string().trim().toLowerCase().pipe(z.email('Correo inválido').max(100)),
  telefono: z.string().trim().regex(/^\+?[0-9\s()-]{7,30}$/, 'Teléfono inválido: solo números, espacios, + - ( )'),
  direccion: z.string().trim().min(5, 'Escribe la dirección y referencia').max(150),
  // Opcional; un texto vacío se guarda como NULL.
  observaciones: z.string().trim().max(255).transform((v) => v || null).nullable().optional(),
});

export const crearClienteSchema = clienteBase;

// PATCH = actualización parcial: todos los campos opcionales, pero al menos uno.
// (.partial() va ANTES de .refine(): Zod no permite lo contrario.)
export const actualizarClienteSchema = clienteBase
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo para actualizar');

export const listarClientesSchema = z.object({
  pagina: paginaSchema,
  q: busquedaSchema,
  orden: z.enum(['todos', 'recientes', 'alfabetico']).default('todos'),
});

export const eliminarClientesSchema = z.object({ ids: idsSchema });

export type DatosCliente = z.infer<typeof crearClienteSchema>;
export type CambiosCliente = z.infer<typeof actualizarClienteSchema>;
export type ListarClientes = z.infer<typeof listarClientesSchema>;