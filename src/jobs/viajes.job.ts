// Tarea programada: cada día a las 00:05 (hora de El Salvador) los viajes Planificados cuya
// salida ya llegó pasan a "En proceso". También corre UNA vez al arrancar: si el servidor estuvo
// apagado a medianoche, se pone al día. Un error aquí se registra pero NUNCA tumba la API.
// No se inicia desde app.ts sino desde server.ts, para que las pruebas con supertest no
// dejen tareas corriendo de fondo.
import cron from 'node-cron';
import { iniciarViajesDelDia } from '../modules/viajes/viajes.service.js';
import { logger } from '../utils/logger.js';

export function programarTareas() {
  const correr = async () => {
    try {
      const codigos = await iniciarViajesDelDia();
      if (codigos.length > 0) logger.info({ viajes: codigos }, 'Viajes pasados a "En proceso"');
    } catch (err) {
      logger.error({ err }, 'Falló la tarea de inicio automático de viajes');
    }
  };
  void correr();
  cron.schedule('5 0 * * *', correr, { timezone: 'America/El_Salvador' });
}