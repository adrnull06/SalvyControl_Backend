// Ruta PÚBLICA (sin `autenticar`). La protección es el rate-limit por IP, en dos capas:
//   general -> frena a quien dispara consultas a toda velocidad
//   fallos  -> frena a quien prueba códigos al azar (solo cuentan las respuestas con error, p. ej. 404)
// Con `trust proxy` activo en producción (ver app.ts), la IP es la del visitante y no la del proxy.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../utils/errors.js';
import { rastrearPaquete } from './rastreo.service.js';
import { z } from 'zod';


const excedido = (mensaje: string) => ({
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler: (_req: unknown, _res: unknown, next: (e: unknown) => void) =>
    next(new AppError(429, 'DEMASIADAS_CONSULTAS', mensaje)),
});

const limitadorGeneral = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  ...excedido('Demasiadas consultas. Espera un momento e inténtalo de nuevo'),
});

const limitadorFallos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  ...excedido('Demasiados intentos con códigos no válidos. Espera 15 minutos'),
});

const codigoSchema = z.string().min(1).max(50);

export const rastreoRouter = Router();

rastreoRouter.get('/:codigo', limitadorGeneral, limitadorFallos, async (req, res) => {
  // no-store: el estado cambia; ningún navegador ni proxy debe mostrar una respuesta vieja.
  res.set('Cache-Control', 'no-store');
  res.json(await rastrearPaquete(codigoSchema.parse(req.params.codigo)));});