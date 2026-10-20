// Dibuja un `Reporte` como PDF horizontal (hay columnas de sobra). pdfkit no sabe de tablas:
// la dibujamos a mano con filas de alto fijo. Cada texto se recorta a su celda para que nunca
// se monte sobre la columna vecina. Todo se arma en memoria (límite de 5000 filas) y se entrega
// como un solo Buffer.
import PDFDocument from 'pdfkit';
import { fechaUS, textoCelda, type Reporte } from './reportes.tipos.js';

const MARGEN = 36;
const ALTO_FILA = 16;

export function aPdf(r: Reporte): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGEN, bufferPages: true });
    const partes: Buffer[] = [];
    doc.on('data', (c: Buffer) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - MARGEN * 2;
    const suma = r.columnas.reduce((a, c) => a + c.ancho, 0);
    const anchos = r.columnas.map((c) => (c.ancho / suma) * anchoUtil); // `ancho` como proporción
    const limiteY = () => doc.page.height - MARGEN - 20; // deja sitio al número de página

    const recortar = (texto: string, ancho: number) => {
      if (doc.widthOfString(texto) <= ancho) return texto;
      let s = texto;
      while (s.length > 1 && doc.widthOfString(`${s}...`) > ancho) s = s.slice(0, -1);
      return `${s}...`;
    };

    const dibujarFila = (valores: string[], y: number, estilo: 'encabezado' | 'par' | 'impar') => {
      if (estilo === 'encabezado') doc.rect(MARGEN, y, anchoUtil, ALTO_FILA).fill('#1F4E78');
      else if (estilo === 'impar') doc.rect(MARGEN, y, anchoUtil, ALTO_FILA).fill('#F2F2F2');
      doc.fillColor(estilo === 'encabezado' ? '#FFFFFF' : '#000000');
      doc.font(estilo === 'encabezado' ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      let x = MARGEN;
      valores.forEach((v, i) => {
        const col = r.columnas[i]!;
        const w = anchos[i]!;
        const derecha = col.tipo !== 'texto'; // números alineados a la derecha
        doc.text(recortar(v, w - 6), x + 3, y + 4, { width: w - 6, lineBreak: false, align: derecha ? 'right' : 'left' });
        x += w;
      });
    };

    // Encabezado del documento.
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text(r.titulo, MARGEN, MARGEN);
    const generado = new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' });
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
      .text(`Periodo: ${fechaUS(r.desde)} al ${fechaUS(r.hasta)}   |   Generado: ${generado}`);
    doc.moveDown(0.6).fillColor('#000000');
    for (const x of r.resumen) {
      doc.font('Helvetica-Bold').fontSize(10).text(`${x.etiqueta}: `, { continued: true });
      doc.font('Helvetica').text(x.valor);
    }

    // Tabla. Al llegar al final de la hoja se abre otra y se repite el encabezado.
    let y = doc.y + 12;
    const titulos = r.columnas.map((c) => c.titulo);
    dibujarFila(titulos, y, 'encabezado');
    y += ALTO_FILA;

    if (r.filas.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#555555').text('No hay registros en este rango.', MARGEN, y + 8);
    }
    r.filas.forEach((f, n) => {
      if (y + ALTO_FILA > limiteY()) {
        doc.addPage();
        y = MARGEN;
        dibujarFila(titulos, y, 'encabezado');
        y += ALTO_FILA;
      }
      dibujarFila(r.columnas.map((c) => textoCelda(c, f[c.clave] ?? null)), y, n % 2 ? 'impar' : 'par');
      y += ALTO_FILA;
    });

    // Número de página en cada hoja. Se pone margen inferior 0 para que pdfkit no abra una página
    // nueva al escribir tan abajo.
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#777777')
        .text(`Página ${i + 1} de ${count}`, MARGEN, doc.page.height - 28, { width: anchoUtil, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}