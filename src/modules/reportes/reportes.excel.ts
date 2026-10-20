// Dibuja un `Reporte` como libro de Excel. Dinero y libras se escriben como NÚMEROS (con formato),
// no como texto, para que el usuario pueda sumarlos, ordenarlos o filtrarlos en Excel.
import ExcelJS from 'exceljs';
import { fechaUS, type Reporte } from './reportes.tipos.js';

export async function aExcel(r: Reporte): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SalvyBox';
  const ws = wb.addWorksheet('Reporte');

  ws.addRow([r.titulo]).font = { bold: true, size: 14 };
  ws.addRow([`Periodo: ${fechaUS(r.desde)} al ${fechaUS(r.hasta)}`]);
  ws.addRow([]);
  for (const x of r.resumen) {
    const fila = ws.addRow([x.etiqueta, x.valor]);
    fila.getCell(1).font = { bold: true };
  }
  ws.addRow([]);

  const encabezado = ws.addRow(r.columnas.map((c) => c.titulo));
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  ws.views = [{ state: 'frozen', ySplit: encabezado.number }]; // el encabezado queda fijo al bajar

  for (const f of r.filas) {
    const fila = ws.addRow(
      r.columnas.map((c) => {
        const v = f[c.clave] ?? null;
        return v !== null && (c.tipo === 'dinero' || c.tipo === 'libras') ? Number(v) : v;
      }),
    );
    r.columnas.forEach((c, i) => {
      if (c.tipo === 'dinero') fila.getCell(i + 1).numFmt = '$#,##0.00';
      if (c.tipo === 'libras') fila.getCell(i + 1).numFmt = '#,##0.00';
    });
  }

  r.columnas.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(c.ancho, 16);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}