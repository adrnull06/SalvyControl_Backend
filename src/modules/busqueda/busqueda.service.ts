// Búsqueda general (barra superior). Máximo 3 resultados en total, de paquetes, viajes o clientes.
// Cada tipo se busca por SUS identificadores (ver decisiones) y devuelve datos relacionados.
import { desc, eq, ilike, or, sql, type AnyColumn } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cliente, estadoPaquete, estadoViaje, paquete, viaje } from '../../db/schema/index.js';
import { patronBusqueda } from '../../utils/validacion.js';

const MAX_RESULTADOS = 3;
const ordenTipo = { paquete: 0, viaje: 1, cliente: 2 } as const; // desempate si el puntaje es igual

export async function buscarGeneral(entrada: string) {
  const q = entrada.trim();
  if (q.length < 2) return { datos: [] }; // con 1 letra casi todo coincide: no sirve de nada

  const patron = patronBusqueda(q); // %texto%  -> "contiene"
  const prefijo = `${q.replace(/[\\%_]/g, '\\$&')}%`; // texto%   -> "empieza con" (escapando comodines)

  // Puntaje de relevancia (menor = mejor): 0 coincidencia exacta, 1 empieza con, 2 contiene.
  // Con varios campos se toma el mejor de ellos.
  const puntaje = (...campos: AnyColumn[]) => {
    const partes = campos.map(
      (c) => sql`case when lower(${c}) = lower(${q}) then 0 when ${c} ilike ${prefijo} then 1 else 2 end`,
    );
    return sql<number>`least(${sql.join(partes, sql`, `)})`;
  };

  const pPaquete = puntaje(paquete.codigoRastreo);
  const pViaje = puntaje(viaje.codigoViaje);
  const pCliente = puntaje(cliente.nombre, cliente.correo, cliente.telefono);

  // Las 3 búsquedas son independientes: se lanzan a la vez. Cada una trae como máximo 3 (más no
  // podrían entrar en el resultado final).
  const [paquetes, viajes, clientes] = await Promise.all([
    db
      .select({
        id: paquete.idPaquete,
        codigo: paquete.codigoRastreo,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        estado: estadoPaquete.nombre,
        codigoViaje: viaje.codigoViaje,
        pesoLibras: paquete.pesoLibras,
        puntaje: pPaquete,
      })
      .from(paquete)
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .where(ilike(paquete.codigoRastreo, patron))
      .orderBy(pPaquete, desc(paquete.idPaquete))
      .limit(MAX_RESULTADOS),
    db
      .select({
        id: viaje.idViaje,
        codigo: viaje.codigoViaje,
        origen: viaje.lugarOrigen,
        destino: viaje.lugarDestino,
        estado: estadoViaje.nombre,
        fechaSalida: viaje.fechaSalida,
        fechaLlegada: viaje.fechaLlegada,
        totalPaquetes: sql<number>`count(${paquete.idPaquete})::int`, // ::int porque count() llega como texto
        puntaje: pViaje,
      })
      .from(viaje)
      .innerJoin(estadoViaje, eq(viaje.idEstadoViaje, estadoViaje.id))
      .leftJoin(paquete, eq(paquete.idViaje, viaje.idViaje))
      .where(ilike(viaje.codigoViaje, patron))
      .groupBy(viaje.idViaje, estadoViaje.id)
      .orderBy(pViaje, desc(viaje.idViaje))
      .limit(MAX_RESULTADOS),
    db
      .select({
        id: cliente.idCliente,
        nombre: cliente.nombre,
        correo: cliente.correo,
        telefono: cliente.telefono,
        totalPaquetes: sql<number>`count(${paquete.idPaquete})::int`,
        puntaje: pCliente,
      })
      .from(cliente)
      .leftJoin(paquete, eq(paquete.idCliente, cliente.idCliente))
      .where(or(ilike(cliente.nombre, patron), ilike(cliente.correo, patron), ilike(cliente.telefono, patron)))
      .groupBy(cliente.idCliente)
      .orderBy(pCliente, desc(cliente.idCliente))
      .limit(MAX_RESULTADOS),
  ]);

  // Unimos los tres grupos, ordenamos por relevancia y cortamos en 3.
  // `busqueda` = lo que el frontend pone en ?q= de la sección destino al hacer clic.
  const todos = [
    ...paquetes.map(({ puntaje: pt, ...p }) => ({
      pt: Number(pt), tipo: 'paquete' as const, item: { tipo: 'paquete' as const, ...p, busqueda: p.codigo },
    })),
    ...viajes.map(({ puntaje: pt, origen, destino, ...v }) => ({
      pt: Number(pt), tipo: 'viaje' as const,
      item: { tipo: 'viaje' as const, ...v, ruta: `${origen} → ${destino}`, busqueda: v.codigo },
    })),
    ...clientes.map(({ puntaje: pt, ...c }) => ({
      pt: Number(pt), tipo: 'cliente' as const, item: { tipo: 'cliente' as const, ...c, busqueda: c.correo },
    })),
  ];
  todos.sort((a, b) => a.pt - b.pt || ordenTipo[a.tipo] - ordenTipo[b.tipo]);

  return { datos: todos.slice(0, MAX_RESULTADOS).map((r) => r.item) };
}