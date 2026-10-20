// Piezas de validación y paginación reutilizables por TODOS los módulos (paquetes, viajes...).
// Centralizarlas evita copiar y pegar lo mismo y que cada módulo pagine distinto.
import { z } from 'zod';

export const POR_PAGINA = 10;

// Los parámetros de la URL siempre llegan como texto ("2"); `coerce` los convierte a número.
// El máximo evita pedir páginas absurdas (offset enorme = consulta lenta).
export const paginaSchema = z.coerce.number().int().min(1).max(100_000).default(1);

// Id de la URL (/clientes/5). El máximo es el límite de un INTEGER de PostgreSQL:
// sin él, un id gigante provocaría un error de BD (500) en vez de un 400 claro.
export const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

// Lista de ids para acciones múltiples. Máximo 100 por solicitud, sin repetidos.
export const idsSchema = z
  .array(idSchema)
  .min(1, 'Selecciona al menos un registro')
  .max(100, 'Máximo 100 registros por acción')
  .transform((ids) => [...new Set(ids)]);

// Texto de búsqueda opcional. Vacío = sin búsqueda.
export const busquedaSchema = z.string().trim().max(100).optional();

// En SQL, % y _ son comodines de LIKE. Si el usuario busca "50%" no debe actuar como comodín.
// Los escapamos con \ (el carácter de escape por defecto de PostgreSQL).
export const patronBusqueda = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

// Formato de paginación que recibe el frontend para "Mostrando x de y".
export const armarPaginacion = (pagina: number, total: number) => ({
  pagina,
  porPagina: POR_PAGINA,
  total,
  totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
});

export const textoOpcional = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null).nullable().optional();