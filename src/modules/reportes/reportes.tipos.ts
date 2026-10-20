// Formato común de TODO reporte, sin importar su tipo ni su formato de salida.
// Los constructores de datos producen un `Reporte`; los exportadores (PDF/Excel) solo lo dibujan.
// `ancho` es el ancho en caracteres: Excel lo usa tal cual y el PDF lo toma como proporción.
export type TipoColumna = 'texto' | 'dinero' | 'libras' | 'entero';
export interface Columna {
  clave: string;
  titulo: string;
  ancho: number;
  tipo: TipoColumna;
}
export type Celda = string | number | null;
export interface Reporte {
  titulo: string;
  desde: string; // AAAA-MM-DD
  hasta: string;
  resumen: { etiqueta: string; valor: string }[];
  columnas: Columna[];
  filas: Record<string, Celda>[];
}

// "2026-10-19" -> "10/19/2026" (formato que pediste para mostrar).
export const fechaUS = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

// Centavos enteros: sumar decimales en JavaScript da errores (0.1 + 0.2), los enteros no.
export const aCentavos = (v: string) => Math.round(Number(v) * 100);
const dosDecimales = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (centavos: number) => `$${dosDecimales(centavos / 100)}`;
export const lb = (centavos: number) => `${dosDecimales(centavos / 100)} lb`;

// Cómo se muestra una celda como texto (lo usa el PDF).
export const textoCelda = (c: Columna, v: Celda) => {
  if (v === null) return '';
  if (c.tipo === 'dinero') return `$${dosDecimales(Number(v))}`;
  if (c.tipo === 'libras') return dosDecimales(Number(v));
  return String(v);
};