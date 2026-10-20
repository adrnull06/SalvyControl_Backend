// Exige sesión (admin o superadmin). Sin parámetros: siempre devuelve el mismo resumen.
import { Router } from 'express';
import { autenticar } from '../../middlewares/auth.js';
import { obtenerDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();
dashboardRouter.use(autenticar);

dashboardRouter.get('/', async (_req, res) => {
  res.set('Cache-Control', 'no-store'); // son cifras vivas: que ningún navegador muestre una copia vieja
  res.json(await obtenerDashboard());
});