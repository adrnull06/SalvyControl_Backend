// Validación de lo que llega del frontend (Zod elimina los campos desconocidos).
// Nota: el código del viaje NO se acepta aquí. Siempre lo genera el servidor.
import { z } from 'zod';
import { busquedaSchema } from '../../utils/validacion.js';

// Ciudad: se limpia (trim) y se colapsan espacios dobles, así "San  Salvador " = "San Salvador".
// El frontend ofrecerá sugerencias de ciudades ya usadas (GET /viajes/ciudades) para no escribirlas distinto.
const ciudad = z
  .string()
  .trim()
  .min(2, 'Escribe una ciudad válida')
  .max(50)
  .transform((v) => v.replace(/\s+/g, ' '));

// Fecha ISO "2026-11-10". Zod valida que exista de verdad (rechaza "2026-02-31").
const fecha = z.iso.date('Fecha inválida (formato AAAA-MM-DD)');

const viajeBase = z.object({
  lugarOrigen: ciudad,
  lugarDestino: ciudad,
  fechaSalida: fecha,
  fechaLlegada: fecha,
  // Opcional; un texto vacío se guarda como NULL.
  observaciones: z.string().trim().max(150).transform((v) => v || null).nullable().optional(),
});

// Solo se puede elegir uno de estos dos a mano. "Finalizado" tiene su propio endpoint.
const estadoEditable = z.enum(['Planificado', 'En proceso']);

// En ISO, comparar textos equivale a comparar fechas ("2026-11-15" >= "2026-11-10").
export const crearViajeSchema = viajeBase
  .extend({ estado: estadoEditable.default('Planificado') })
  .refine((d) => d.fechaLlegada >= d.fechaSalida, {
    path: ['fechaLlegada'],
    message: 'La fecha de llegada no puede ser anterior a la de salida',
  });

// PATCH = parcial. Como los campos pueden venir sueltos, la comparación de fechas se
// hace en el servicio, mezclando lo enviado con lo que ya hay guardado.
export const actualizarViajeSchema = viajeBase
  .extend({ estado: estadoEditable })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo para actualizar');

export const listarViajesSchema = z.object({
  filtro: z.enum(['todos', 'planificado', 'en_proceso', 'finalizado']).default('todos'),
  q: busquedaSchema,
});

export type DatosViaje = z.infer<typeof crearViajeSchema>;
export type CambiosViaje = z.infer<typeof actualizarViajeSchema>;
export type ListarViajes = z.infer<typeof listarViajesSchema>;