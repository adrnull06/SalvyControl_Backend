// Lógica de clientes y acceso a la BD. Las rutas no tocan la BD directamente.
import { asc, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cliente, paquete } from '../../db/schema/index.js';
import { AppError, noEncontrado } from '../../utils/errors.js';
import { POR_PAGINA, armarPaginacion, patronBusqueda } from '../../utils/validacion.js';
import type { CambiosCliente, DatosCliente, ListarClientes } from './clientes.schemas.js';

// Cada filtro rápido es un orden. El segundo criterio (id) hace el orden ESTABLE: sin él,
// dos clientes con el mismo nombre podrían aparecer en dos páginas distintas o repetirse.
const ordenes = {
  todos: [asc(cliente.idCliente)],
  recientes: [desc(cliente.fechaRegistro), desc(cliente.idCliente)],
  alfabetico: [asc(cliente.nombre), asc(cliente.idCliente)],
};

export async function listarClientes({ pagina, q, orden }: ListarClientes) {
  // Búsqueda en todas las columnas visibles de la tabla. ilike = ignora mayúsculas/minúsculas.
  // (Un índice normal no acelera '%texto%', pero con cientos de clientes es instantáneo.)
  const patron = q ? patronBusqueda(q) : null;
  const donde = patron
    ? or(
        ilike(cliente.nombre, patron),
        ilike(cliente.correo, patron),
        ilike(cliente.telefono, patron),
        ilike(cliente.direccion, patron),
      )
    : undefined;

  // Total y página se piden a la vez (no dependen entre sí). El total respeta la búsqueda,
  // por eso "Mostrando 3 de 3 clientes" es correcto al filtrar.
  const [total, datos] = await Promise.all([
    db.$count(cliente, donde),
    db
      .select()
      .from(cliente)
      .where(donde)
      .orderBy(...ordenes[orden])
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
  ]);

  return { datos, paginacion: armarPaginacion(pagina, total) };
}

export async function obtenerCliente(id: number) {
  const [c] = await db.select().from(cliente).where(eq(cliente.idCliente, id)).limit(1);
  if (!c) throw noEncontrado('Cliente');
  return c;
}

export async function crearCliente(datos: DatosCliente) {
  const [c] = await db.insert(cliente).values(datos).returning();
  if (!c) throw new Error('No se pudo crear el cliente'); // no debería pasar; sale como 500
  return c;
}

export async function actualizarCliente(id: number, cambios: CambiosCliente) {
  const [c] = await db.update(cliente).set(cambios).where(eq(cliente.idCliente, id)).returning();
  if (!c) throw noEncontrado('Cliente');
  return c;
}

// Sirve para borrar uno o varios. Primero revisamos cuáles tienen paquetes para dar un mensaje
// útil. La llave foránea (restrict) sigue siendo la garantía real si algo cambia entre medio.
export async function eliminarClientes(ids: number[]) {
  const conPaquetes = await db
    .selectDistinct({ id: cliente.idCliente, nombre: cliente.nombre })
    .from(paquete)
    .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
    .where(inArray(paquete.idCliente, ids));

  if (conPaquetes.length > 0) {
    throw new AppError(
      409,
      'CLIENTE_CON_PAQUETES',
      conPaquetes.length === 1
        ? 'No se puede eliminar: el cliente tiene paquetes registrados'
        : `No se puede eliminar: ${conPaquetes.length} clientes tienen paquetes registrados`,
      conPaquetes.map((c) => ({ id: c.id, nombre: c.nombre })),
    );
  }

  const borrados = await db.delete(cliente).where(inArray(cliente.idCliente, ids)).returning({ id: cliente.idCliente });
  if (borrados.length === 0) throw noEncontrado('Cliente');
  return borrados.length;
}