// Filtro de texto único para TODAS las búsquedas (?q=). Devuelve una condición SQL, o
// undefined si no hay texto (y `where(undefined)` no filtra nada).
// - columnas:  se comparan ignorando mayúsculas Y tildes (unaccent aplica a ambos lados).
// - telefonos: lo mismo, y además, si lo escrito PARECE un teléfono, se comparan solo los
//   dígitos: "7000-1234", "70001234" y "7000 1234" se encuentran entre sí.
// Por qué en SQL y no guardando un campo normalizado: así no hay datos duplicados que se
// desincronicen ni migraciones extra, y el costo es irrelevante con este volumen.
import { or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { patronBusqueda } from './validacion.js';

export function filtroTexto(
  q: string | undefined,
  columnas: SQLWrapper[],
  telefonos: SQLWrapper[] = [],
): SQL | undefined {
  if (!q) return undefined;
  const patron = patronBusqueda(q); // %texto% con los comodines del usuario ya escapados
  const condiciones = columnas.map((c) => sql`unaccent(${c}) ilike unaccent(${patron})`);

  // "Parece teléfono": solo dígitos y separadores comunes, y al menos 3 dígitos
  // (con 1 o 2 dígitos casi todo coincidiría y la búsqueda no serviría).
  const digitos = q.replace(/\D/g, '');
  const pareceTelefono = digitos.length >= 3 && /^[\d\s()+-]+$/.test(q);

  for (const t of telefonos) {
    condiciones.push(sql`${t} ilike ${patron}`);
    if (pareceTelefono) {
      // regexp_replace quita todo lo que no sea número del teléfono guardado.
      condiciones.push(sql`regexp_replace(${t}, '[^0-9]', '', 'g') like ${`%${digitos}%`}`);
    }
  }
  return or(...condiciones);
}