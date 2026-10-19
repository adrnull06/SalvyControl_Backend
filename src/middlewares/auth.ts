// Dos guardias que se ponen ANTES de una ruta:
//   autenticar   -> "¿tienes sesión válida?"  (si sí, deja los datos en req.usuario)
//   requerirRol  -> "¿tu rol puede entrar aquí?"
// Ejemplo de uso:  router.get('/', autenticar, requerirRol('superadmin'), handler)
import type { RequestHandler, Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { noAutenticado, prohibido } from '../utils/errors.js';
import { buscarUsuarioActivo, type RolNombre, type UsuarioSesion } from '../modules/auth/auth.service.js';

export const COOKIE_SESION = 'sbx_token';

// Le "enseñamos" a TypeScript que Request puede traer `usuario` (si no, se quejaría al usarlo).
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

export const autenticar: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[COOKIE_SESION];
  if (typeof token !== 'string') throw noAutenticado();

  let id = NaN;
  try {
    // `algorithms` fija HS256 de forma explícita: evita ataques que cambian el algoritmo del token.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    id = Number(typeof payload === 'object' ? payload.sub : NaN);
  } catch {
    throw noAutenticado('Tu sesión expiró. Inicia sesión de nuevo');
  }
  if (!Number.isInteger(id)) throw noAutenticado();

  const usuario = await buscarUsuarioActivo(id); // aquí se aplica la desactivación inmediata
  if (!usuario) throw noAutenticado('Sesión inválida. Inicia sesión de nuevo');

  req.usuario = usuario;
  next();
};

export const requerirRol =
  (...roles: RolNombre[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) throw prohibido();
    next();
  };

// Devuelve el usuario de la sesión o lanza 401. Evita escribir `req.usuario!` (el "!" apaga la
// revisión de TypeScript y oculta bugs si algún día olvidamos poner `autenticar` en una ruta).
export const usuarioActual = (req: Request): UsuarioSesion => {
  if (!req.usuario) throw noAutenticado();
  return req.usuario;
};