// Arranca el servidor y lo apaga de forma ordenada. Al desplegar una nueva versión, la nube
// envía la señal SIGTERM: dejamos terminar las peticiones en curso y cerramos la conexión a
// la BD, en vez de cortar a mitad una operación (por ejemplo, un abono a medio guardar).
// El temporizador es la red de seguridad: si algo no cierra en 10 s, se fuerza la salida.
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

const apagar = (senal: string) => {
  logger.info(`${senal} recibida, cerrando...`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));