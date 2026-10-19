// Un único logger compartido por toda la app. En desarrollo se ve con colores y legible;
// en producción sale como JSON (una línea por evento), formato que Railway y DigitalOcean
// pueden buscar y filtrar. console.log no permite niveles (info/warn/error) ni filtrar.
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
});