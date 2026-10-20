// Arma la aplicación Express: seguridad, lectura de datos y rutas. NO abre el puerto
// (eso es server.ts); así las pruebas con supertest importan `app` sin levantar un servidor.
// El ORDEN de los middlewares importa: se ejecutan de arriba hacia abajo.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { sql } from 'drizzle-orm';
import { env } from './config/env.js';
import { db } from './db/client.js';
import { logger } from './utils/logger.js';
import { manejadorErrores, rutaNoEncontrada } from './middlewares/errorHandler.js';
import {authRouter} from './modules/auth/auth.routes.js'
import { clientesRouter } from './modules/clientes/clientes.routes.js';
import { viajesRouter } from './modules/viajes/viajes.routes.js';
import { paquetesRouter } from './modules/paquetes/paquetes.routes.js';
import { catalogosRouter } from './modules/catalogos/catalogos.routes.js';
import { pagosRouter } from './modules/pagos/pagos.routes.js';
import { entregasRouter } from './modules/entregas/entregas.routes.js';
import { usuariosRouter } from './modules/usuarios/usuarios.routes.js';
import { rastreoRouter } from './modules/rastreo/rastreo.routes.js';



export const app = express();

// Detrás del proxy de Railway/DigitalOcean, sin esto Express vería la IP del proxy en vez
// de la del visitante, y el rate-limit bloquearía a todos a la vez. Solo en producción:
// en tu PC no hay proxy y activarlo permitiría falsificar la IP.
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Cabeceras de seguridad HTTP (helmet).
app.use(helmet());

// CORS: solo el frontend puede llamar a la API desde un navegador.
// `credentials: true` es obligatorio para que el navegador envíe la cookie con el token.
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

// Registro de cada petición. Se ocultan cookie y autorización para que el token
// de sesión nunca quede escrito en los logs.
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.cookie', 'req.headers.authorization'],
  }),
);

// Lee JSON del cuerpo. El límite de 100kb evita que alguien envíe cuerpos gigantes
// para saturar el servidor; nuestros formularios son mucho más pequeños.
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// /health: lo usan Railway/DigitalOcean (y tú) para saber si la app está viva.
// Hace un `select 1` para confirmar que también hay conexión con la BD; responder "ok"
// con la BD caída sería engañoso.
app.get('/health', async (_req, res) => {
  await db.execute(sql`select 1`);
  res.json({ estado: 'ok' });
});

//Rutas de cada modulo
app.use('/api/auth', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/viajes', viajesRouter);
app.use('/api/paquetes', paquetesRouter);
app.use('/api/catalogos', catalogosRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/entregas', entregasRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/rastreo', rastreoRouter);


// Siempre al final: primero la ruta inexistente, luego el manejador de errores.
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

