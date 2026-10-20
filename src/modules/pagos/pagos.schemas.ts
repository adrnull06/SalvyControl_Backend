// Validación de lo que llega del frontend (Zod ignora campos desconocidos).
// El dinero llega como número y se guarda como texto con 2 decimales (lo que espera NUMERIC).
// Rechazamos más de 2 decimales (ej. 10.005) para no redondear dinero en silencio.
import { z } from 'zod';
import { busquedaSchema, idSchema, idsSchema, paginaSchema } from '../../utils/validacion.js';

const dineroDesde = (min: number, mensajeMin: string) =>
  z.coerce
    .number()
    .min(min, mensajeMin)
    .max(99_999_999.99, 'Monto demasiado grande')
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Máximo 2 decimales')
    .transform((n) => n.toFixed(2));

const dinero = dineroDesde(0, 'El monto no puede ser negativo'); // costos (pueden ser 0)
const montoPositivo = dineroDesde(0.01, 'El monto debe ser mayor a 0'); // abonos

// Fecha y hora del cobro, en ISO con zona ("2026-10-18T15:00:00Z"). No puede ser futura;
// los 5 minutos de margen cubren relojes ligeramente desfasados entre PC y servidor.
const fechaPago = z.iso
  .datetime({ offset: true, message: 'Fecha inválida (formato ISO con zona horaria)' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now() + 5 * 60_000, 'La fecha de pago no puede estar en el futuro');

// Crear pago = la deuda (+ un primer abono opcional si el cliente ya pagó algo).
// `fechaPago` solo se usa si importeCancelado > 0; si no, se ignora.
export const crearPagoSchema = z.object({
  idPaquete: idSchema,
  costoServicio: dinero,
  costoCompra: dinero.default('0.00'),
  importeCancelado: dinero.default('0.00'),
  fechaPago: fechaPago.optional(),
  idCanalPago: idSchema,
  idMetodoPago: idSchema,
});

// Editar el pago NO toca el paquete (para cambiarlo: eliminar el pago y crear otro)
// ni los abonos (tienen sus propios endpoints).
export const actualizarPagoSchema = z
  .object({ costoServicio: dinero, costoCompra: dinero, idCanalPago: idSchema, idMetodoPago: idSchema })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo para actualizar');

export const crearAbonoSchema = z.object({
  monto: montoPositivo,
  fechaPago: fechaPago.optional(),
  idCanalPago: idSchema,
  idMetodoPago: idSchema,
});

export const actualizarAbonoSchema = z
  .object({ monto: montoPositivo, fechaPago, idCanalPago: idSchema, idMetodoPago: idSchema })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo para actualizar');

export const listarPagosSchema = z.object({
  pagina: paginaSchema,
  q: busquedaSchema,
  filtro: z.enum(['todos', 'pendientes', 'parciales', 'recientes']).default('todos'),
});

export const eliminarPagosSchema = z.object({ ids: idsSchema });

export type DatosPago = z.infer<typeof crearPagoSchema>;
export type CambiosPago = z.infer<typeof actualizarPagoSchema>;
export type DatosAbono = z.infer<typeof crearAbonoSchema>;
export type CambiosAbono = z.infer<typeof actualizarAbonoSchema>;
export type ListarPagos = z.infer<typeof listarPagosSchema>;