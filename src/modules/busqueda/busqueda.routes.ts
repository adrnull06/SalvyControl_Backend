// GET /api/buscar?q=texto. Exige sesión. Zod limita el largo (un texto enorme no es una búsqueda).
import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from '../../middlewares/auth.js';
import { buscarGeneral } from './busqueda.service.js';

const buscarSchema = z.object({ q: z.string().trim().max(100).default('') });

export const busquedaRouter = Router();
busquedaRouter.use(autenticar);

busquedaRouter.get('/', async (req, res) => {
  res.json(await buscarGeneral(buscarSchema.parse(req.query).q));
});