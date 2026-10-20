// Consulta pública de un paquete por su código. NO hay usuario: cualquiera puede llamarla,
// así que aquí se decide, columna por columna, qué información sale al mundo.
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { estadoPaquete, historialEstado, paquete, viaje } from '../../db/schema/index.js';
import { AppError } from '../../utils/errors.js';

// Mismo error para "no existe" y "formato inválido": no revelamos cuál de los dos fue.
const sinResultado = () =>
  new AppError(404, 'NO_ENCONTRADO', 'No encontramos un paquete con ese código. Revisa que esté bien escrito');

// Formato real de nuestros códigos: SBX- + 8 caracteres del alfabeto sin 0/O, 1/I/L (ver utils/codigos.ts).
const FORMATO = /^SBX-[2-9A-HJKMNP-Z]{8}$/;

// Tolera lo que la gente escribe a mano: minúsculas, espacios, o sin guion. Devuelve null si no es válido.
function normalizar(crudo: string): string | null {
  let c = crudo.replace(/\s+/g, '').toUpperCase();
  if (c.length > 20) return null; // un texto enorme no puede ser un código; ni lo procesamos
  if (/^SBX[^-]/.test(c)) c = `SBX-${c.slice(3)}`;
  return FORMATO.test(c) ? c : null;
}

export async function rastrearPaquete(codigoCrudo: string) {
  const codigo = normalizar(codigoCrudo);
  if (!codigo) throw sinResultado(); // formato inválido: ni siquiera tocamos la BD

  // SOLO estas columnas salen del paquete. Nunca cliente, costos ni observaciones.
  const [p] = await db
    .select({
      codigoRastreo: paquete.codigoRastreo,
      pesoLibras: paquete.pesoLibras,
      idEstado: paquete.idEstadoActual,
      estado: estadoPaquete.nombre,
      origen: viaje.lugarOrigen,
      destino: viaje.lugarDestino,
      fechaLlegada: viaje.fechaLlegada,
    })
    .from(paquete)
    .innerJoin(estadoPaquete, eq(paquete.idEstadoActual, estadoPaquete.id))
    .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje)) // LEFT: un paquete aún sin viaje también se rastrea
    .where(eq(paquete.codigoRastreo, codigo))
    .limit(1);
  if (!p) throw sinResultado();

  // Todos los estados en orden (el orden del seed coincide con el flujo real) y, por estado,
  // la fecha más reciente en que el paquete llegó a él. Fecha en ISO UTC, igual que en Pagos.
  const [estados, cambios] = await Promise.all([
    db.select().from(estadoPaquete).orderBy(asc(estadoPaquete.id)),
    db
      .select({
        idEstado: historialEstado.idEstado,
        fecha: sql<string>`to_char(max(${historialEstado.fechaCambio}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(historialEstado)
      .innerJoin(paquete, eq(historialEstado.idPaquete, paquete.idPaquete))
      .where(eq(paquete.codigoRastreo, codigo))
      .groupBy(historialEstado.idEstado),
  ]);

  const fechas = new Map(cambios.map((c) => [c.idEstado, c.fecha]));
  const posicionActual = estados.findIndex((e) => e.id === p.idEstado);

  return {
    codigoRastreo: p.codigoRastreo,
    estadoActual: p.estado,
    pesoLibras: p.pesoLibras,
    ruta: p.origen && p.destino ? { origen: p.origen, destino: p.destino } : null,
    fechaEstimadaLlegada: p.fechaLlegada ?? null,
    // Una etapa está completada si está en la posición actual o antes. Las posteriores no muestran
    // fecha aunque existan en el historial (caso de un retroceso por corrección).
    etapas: estados.map((e, i) => ({
      estado: e.nombre,
      completada: i <= posicionActual,
      actual: e.id === p.idEstado,
      fecha: i <= posicionActual ? (fechas.get(e.id) ?? null) : null,
    })),
  };
}