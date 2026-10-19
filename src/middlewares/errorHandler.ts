// Manejador central de errores: TODO error de la API termina aquí y sale con el MISMO formato:
// { error: { codigo, mensaje, detalles? } }. Así el frontend siempre sabe cómo leer un error.
// Seguridad: de errores desconocidos (bugs, fallas de BD) NUNCA devolvemos el mensaje real,
// porque podría revelar nombres de tablas o consultas. Se guarda en el log y al cliente solo
// le decimos "Error interno".
// Express 5 envía aquí también los errores de funciones async, sin código extra.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Drizzle envuelve el error original de PostgreSQL en `cause`; revisamos ambos sitios.
const codigoPg = (err: unknown): string | undefined => {
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const codigo = e?.cause?.code ?? e?.code;
  return typeof codigo === 'string' ? codigo : undefined;
};

// Ruta que no existe -> 404 con nuestro formato (si no, Express devuelve HTML).
export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `Ruta ${req.method} ${req.path} no existe`));
};

// Los 4 parámetros son obligatorios: así Express reconoce esto como manejador de errores.
export const manejadorErrores: ErrorRequestHandler = (err, req, res, _next) => {
  // Datos que no pasaron la validación de Zod (el cliente envió algo mal).
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Hay datos inválidos en la solicitud',
        detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      },
    });
    return;
  }

  // Errores que lanzamos nosotros a propósito.
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { codigo: err.codigo, mensaje: err.message, detalles: err.detalles },
    });
    return;
  }

  // Violaciones de reglas de la BD: 23505 = valor duplicado (UNIQUE), 23503 = referencia
  // inválida o registro en uso (FOREIGN KEY), 23514 = no cumple un CHECK.
  // Son errores del cliente, no de nuestro código, así que no deben ser un 500.
  const pg = codigoPg(err);
  if (pg === '23505') {
    res.status(409).json({ error: { codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con esos datos' } });
    return;
  }
  if (pg === '23503') {
    res.status(409).json({ error: { codigo: 'REFERENCIA_INVALIDA', mensaje: 'El registro está en uso o hace referencia a algo que no existe' } });
    return;
  }
  if (pg === '23514') {
    res.status(400).json({ error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos no cumplen las reglas del sistema' } });
    return;
  }

  // JSON mal formado en el cuerpo de la petición (lo detecta express.json).
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la solicitud no es un JSON válido' } });
    return;
  }

  // Cualquier otra cosa es un bug nuestro: se registra completo y se responde genérico.
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Error no controlado');
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' } });
};