// Validación de los parámetros. Las fechas llegan en ISO (AAAA-MM-DD) y Zod verifica que existan.
// Comparar textos ISO equivale a comparar fechas ("2026-11-15" >= "2026-11-10").
// El límite de 366 días evita pedir "toda la historia" de un solo golpe.
import { z } from 'zod';

const fecha = z.iso.date('Fecha inválida (formato AAAA-MM-DD)');

export const generarReporteSchema = z
  .object({
    tipo: z.enum(['financiero', 'paquetes', 'viajes']),
    desde: fecha,
    hasta: fecha,
    formato: z.enum(['pdf', 'excel', 'json']).default('pdf'),
  })
  .refine((d) => d.hasta >= d.desde, {
    path: ['hasta'],
    message: 'La fecha final no puede ser anterior a la inicial',
  })
  .refine((d) => (Date.parse(d.hasta) - Date.parse(d.desde)) / 86_400_000 <= 366, {
    path: ['hasta'],
    message: 'El rango máximo es de 366 días',
  });

export type TipoReporte = z.infer<typeof generarReporteSchema>['tipo'];