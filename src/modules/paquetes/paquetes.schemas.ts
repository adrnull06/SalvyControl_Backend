// Validación de lo que llega del frontend (Zod ignora los campos desconocidos).
// Nunca se acepta `codigoRastreo` ni `fechaHoraRecepcion`: los pone el servidor.
// El peso llega como número y se convierte a texto con 2 decimales, que es lo que espera NUMERIC.
// `.min(0.01)` evita que 0.004 se redondee a "0.00" y la BD lo rechace con un error confuso.
import { z } from 'zod';
import { busquedaSchema, idSchema, idsSchema, paginaSchema, textoOpcional } from '../../utils/validacion.js';

const paqueteBase = z.object({
  idCliente: idSchema,
  idViaje: idSchema.nullable().optional(), // sin viaje = todavía no asignado
  tiendaProcedencia: z.string().trim().min(2, 'Indica la tienda de procedencia o "Encomienda"').max(100),
  descripcion: textoOpcional(255),
  observaciones: textoOpcional(255),
  pesoLibras: z.coerce
    .number()
    .min(0.01, 'El peso debe ser mayor a 0')
    .max(100_000, 'Peso demasiado grande')
    .transform((n) => n.toFixed(2)),
  idMetodoEntrega: idSchema,
  lugarEntrega: textoOpcional(150),
});

export const crearPaqueteSchema = paqueteBase.extend({ idEstadoInicial: idSchema });

// PATCH = parcial. El estado NO se edita aquí: tiene su propio endpoint (deja historial).
export const actualizarPaqueteSchema = paqueteBase
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo para actualizar');

export const listarPaquetesSchema = z.object({
  pagina: paginaSchema,
  q: busquedaSchema,
  filtro: z.enum(['todos', 'recientes', 'listos', 'en_transito', 'sin_pago']).default('todos'),
});

export const opcionesPaquetesSchema = z.object({ q: busquedaSchema });
export const cambiarEstadoSchema = z.object({ ids: idsSchema, idEstado: idSchema });
export const eliminarPaquetesSchema = z.object({ ids: idsSchema });

export type DatosPaquete = z.infer<typeof crearPaqueteSchema>;
export type CambiosPaquete = z.infer<typeof actualizarPaqueteSchema>;
export type ListarPaquetes = z.infer<typeof listarPaquetesSchema>;