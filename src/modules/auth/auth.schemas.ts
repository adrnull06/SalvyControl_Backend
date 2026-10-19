// Reglas de validación de lo que el cliente envía. Zod revisa ANTES de tocar la BD.
// Contraseña: mínimo 10 y máximo 128. Importa más la longitud que exigir símbolos raros
// (recomendación actual de NIST); el máximo evita que alguien envíe textos enormes para
// hacer trabajar al hash en vano (argon2 es lento a propósito).
import { z } from 'zod';

export const contrasenaNueva = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres');

// Para CREAR usuarios (lo usaremos también en el módulo de usuarios): se convierte a minúsculas
// y solo permite caracteres simples, así no hay usuarios parecidos ni con espacios invisibles.
export const nombreUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(100)
  .regex(/^[a-z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo');

// En el LOGIN no aplicamos reglas estrictas: si el usuario o la clave están mal,
// la respuesta debe ser siempre el mismo mensaje genérico, no un error de formato.
export const loginSchema = z.object({
  usuario: z.string().trim().toLowerCase().min(1, 'Ingresa tu usuario').max(100),
  contrasena: z.string().min(1, 'Ingresa tu contraseña').max(128),
});

export const cambiarContrasenaSchema = z
  .object({
    contrasenaActual: z.string().min(1, 'Ingresa tu contraseña actual').max(128),
    contrasenaNueva,
  })
  .refine((d) => d.contrasenaActual !== d.contrasenaNueva, {
    path: ['contrasenaNueva'],
    message: 'La nueva contraseña debe ser distinta a la actual',
  });