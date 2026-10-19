// Error "esperado" que lanzamos nosotros a propósito (ej. "paquete no encontrado").
// Lleva el código HTTP y un código interno estable (ej. 'NO_ENCONTRADO') que el frontend
// puede usar para decidir qué mostrar, sin depender del texto del mensaje.
// Con esto, cualquier parte del código hace `throw new AppError(...)` y el manejador central
// lo convierte en respuesta; no repetimos try/catch ni res.status(...) en cada ruta.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
  }
}

// Atajos para los casos más comunes.
export const noEncontrado = (recurso: string) =>
  new AppError(404, 'NO_ENCONTRADO', `${recurso} no encontrado`);
export const conflicto = (mensaje: string) => new AppError(409, 'CONFLICTO', mensaje);
export const noAutenticado = (mensaje = 'Debes iniciar sesión') =>
  new AppError(401, 'NO_AUTENTICADO', mensaje);
export const prohibido = (mensaje = 'No tienes permiso para esto') =>
  new AppError(403, 'PROHIBIDO', mensaje);