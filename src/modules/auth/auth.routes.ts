// Endpoints de sesión. Cada handler: valida con Zod -> llama al servicio -> responde.
// Express 5 captura solos los errores de funciones async; no hace falta try/catch.
import { Router, type CookieOptions } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { autenticar, usuarioActual, COOKIE_SESION } from '../../middlewares/auth.js';
import { cambiarContrasenaSchema, loginSchema } from './auth.schemas.js';
import { cambiarContrasena, iniciarSesion, SESION_SEGUNDOS } from './auth.service.js';

// Cookie de sesión:
//  httpOnly -> JavaScript del navegador NO puede leerla (un XSS no roba el token).
//  secure   -> solo viaja por HTTPS. Solo en producción: en tu PC usas http://localhost.
//  sameSite 'strict' -> el navegador no la envía desde otros sitios (protege contra CSRF).
//    Funciona porque frontend y API serán del mismo "sitio" (localhost; salvybox.com y api.salvybox.com).
const opcionesCookie: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

// Freno de fuerza bruta: 10 intentos FALLIDOS por IP cada 15 min (los exitosos no cuentan).
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Espera 15 minutos')),
});

export const authRouter = Router();

authRouter.post('/login', limitadorLogin, async (req, res) => {
  const { usuario, contrasena } = loginSchema.parse(req.body);
  const { token, sesion } = await iniciarSesion(usuario, contrasena);
  res.cookie(COOKIE_SESION, token, { ...opcionesCookie, maxAge: SESION_SEGUNDOS * 1000 });
  res.json({ usuario: sesion });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_SESION, opcionesCookie); // debe usar las mismas opciones con que se creó
  res.json({ mensaje: 'Sesión cerrada' });
});

// El frontend lo llama al cargar para saber si hay sesión y qué rol tiene (mostrar u ocultar menús).
authRouter.get('/me', autenticar, (req, res) => {
  res.json({ usuario: usuarioActual(req) });
});

authRouter.post('/cambiar-contrasena', autenticar, async (req, res) => {
  const { contrasenaActual, contrasenaNueva } = cambiarContrasenaSchema.parse(req.body);
  await cambiarContrasena(usuarioActual(req).id, contrasenaActual, contrasenaNueva);
  res.json({ mensaje: 'Contraseña actualizada' });
});