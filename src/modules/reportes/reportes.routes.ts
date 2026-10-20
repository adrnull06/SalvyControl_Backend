// /resumen va ANTES de /:tipo; si no, Express interpretaría "resumen" como un tipo de reporte.
// El archivo se arma completo en memoria y se envía de una vez, así un error a mitad de la
// generación se responde como error normal y no como un archivo cortado.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { autenticar } from '../../middlewares/auth.js';
import { AppError } from '../../utils/errors.js';
import { aExcel } from './reportes.excel.js';
import { aPdf } from './reportes.pdf.js';
import { construirReporte } from './reportes.datos.js';
import { resumenReportes } from './reportes.resumen.js';
import { generarReporteSchema } from './reportes.schemas.js';

// Generar archivos es lo más pesado de la API: 10 por minuto por IP bastan para uso humano.
const limitador = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new AppError(429, 'DEMASIADOS_REPORTES', 'Demasiados reportes seguidos. Espera un momento')),
});

export const reportesRouter = Router();
reportesRouter.use(autenticar);

reportesRouter.get('/resumen', async (_req, res) => {
  res.set('Cache-Control', 'no-store'); // cifras vivas
  res.json(await resumenReportes());
});

reportesRouter.get('/:tipo', limitador, async (req, res) => {
  const { tipo, desde, hasta, formato } = generarReporteSchema.parse({ ...req.query, tipo: req.params.tipo });
  const reporte = await construirReporte(tipo, desde, hasta);
  res.set('Cache-Control', 'no-store');

  if (formato === 'json') {
    res.json(reporte);
    return;
  }
  const nombre = `reporte-${tipo}_${desde}_${hasta}`; // solo caracteres seguros: viene de datos ya validados
  if (formato === 'excel') {
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}.xlsx"`,
    });
    res.send(await aExcel(reporte));
    return;
  }
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nombre}.pdf"` });
  res.send(await aPdf(reporte));
});