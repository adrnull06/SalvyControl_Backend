import { z } from 'zod';
import { busquedaSchema, idsSchema, paginaSchema } from '../../utils/validacion.js';

// Los 3 filtros rápidos de tu documento. Son filtros reales (cambian QUÉ paquetes salen).
export const listarEntregasSchema = z.object({
  pagina: paginaSchema,
  q: busquedaSchema,
  filtro: z.enum(['todas', 'listas', 'hoy']).default('todas'),
});

// Selección múltiple: 1 o más paquetes a marcar como entregados.
export const completarEntregasSchema = z.object({ ids: idsSchema });

export type ListarEntregas = z.infer<typeof listarEntregasSchema>;