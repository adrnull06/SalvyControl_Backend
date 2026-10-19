// Crea el PRIMER superadmin. Es un script aparte porque desde la app nadie puede crearlo:
// para crear usuarios hay que haber iniciado sesión como superadmin (huevo y gallina).
// Pide los datos por consola y NO por parámetros: lo que escribes en un comando queda en el
// historial de la terminal, y una contraseña ahí es un riesgo. Mientras escribes la contraseña
// no se muestra nada. Se niega a correr si ya existe un superadmin.
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { rol, usuario } from '../db/schema/index.js';
import { contrasenaNueva, nombreUsuario } from '../modules/auth/auth.schemas.js';

let oculto = false;
const salida = new Writable({
  write(chunk, codificacion, cb) {
    if (!oculto) process.stdout.write(chunk, codificacion);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output: salida, terminal: true });

const preguntar = (texto: string, ocultar = false) =>
  new Promise<string>((resolver) => {
    process.stdout.write(texto);
    oculto = ocultar;
    rl.question('', (respuesta) => {
      oculto = false;
      if (ocultar) process.stdout.write('\n');
      resolver(respuesta);
    });
  });

try {
  const [rolSuper] = await db.select().from(rol).where(eq(rol.nombre, 'superadmin')).limit(1);
  if (!rolSuper) throw new Error('No existe el rol superadmin. Ejecuta primero: npm run db:seed');

  const [existente] = await db.select({ id: usuario.idUsuario }).from(usuario).where(eq(usuario.idRol, rolSuper.id)).limit(1);
  if (existente) throw new Error('Ya existe un superadmin. Los demás se crean desde la aplicación.');

  const nombre = nombreUsuario.safeParse(await preguntar('Usuario: '));
  if (!nombre.success) throw new Error(nombre.error.issues[0]?.message ?? 'Usuario inválido');

  const clave = contrasenaNueva.safeParse(await preguntar('Contraseña (mín. 10): ', true));
  if (!clave.success) throw new Error(clave.error.issues[0]?.message ?? 'Contraseña inválida');

  if ((await preguntar('Repite la contraseña: ', true)) !== clave.data) throw new Error('Las contraseñas no coinciden');

  await db.insert(usuario).values({
    usuario: nombre.data,
    contrasenaHash: await argon2.hash(clave.data),
    idRol: rolSuper.id,
  });
  console.log(`Superadmin "${nombre.data}" creado.`);
} catch (err) {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  rl.close();
  await pool.end();
}