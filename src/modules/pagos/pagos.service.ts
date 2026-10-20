import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { abono, canalPago, cliente, metodoPago, paquete, pago, usuario, viaje } from '../../db/schema/index.js';
import { AppError, conflicto, noEncontrado } from '../../utils/errors.js';
import { POR_PAGINA, armarPaginacion } from '../../utils/validacion.js';
import type { CambiosAbono, CambiosPago, DatosAbono, DatosPago, ListarPagos } from './pagos.schemas.js';
import { filtroTexto } from '../../utils/busqueda.js';

const POR_DEFINIR = 'Por definir';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]; // tipo de `tx` dentro de una transacción

// Para validar dinero comparamos en CENTAVOS (enteros): sumar decimales en JavaScript
// da errores (0.1 + 0.2 = 0.30000000000000004), los enteros no.
const centavos = (v: string) => Math.round(Number(v) * 100);
const aDinero = (c: number) => (c / 100).toFixed(2);

// --- Todo lo calculado vive en SQL, así el estado nunca se desincroniza ---
// Subconsulta: por cada pago, cuánto se ha cobrado y cuándo fue el último abono.
export const resumen = db
    .select({
        idPago: abono.idPago,
        pagado: sql<string>`sum(${abono.monto})`.as('pagado'),
        ultima: sql<Date>`max(${abono.fechaPago})`.as('ultima'),
    })
    .from(abono)
    .groupBy(abono.idPago)
    .as('resumen_abonos');

const ultimoAbono = db
    .selectDistinctOn([abono.idPago], {
        idPago: abono.idPago,
        monto: abono.monto,
        idCanalPago: abono.idCanalPago,
        idMetodoPago: abono.idMetodoPago,
    })
    .from(abono)
    .orderBy(abono.idPago, desc(abono.fechaPago), desc(abono.idAbono))
    .as('ultimo_abono');

const canalIdSql = sql<number>`coalesce(${ultimoAbono.idCanalPago}, ${pago.idCanalPago})`;
const metodoIdSql = sql<number>`coalesce(${ultimoAbono.idMetodoPago}, ${pago.idMetodoPago})`;

export const pagadoSql = sql`coalesce(${resumen.pagado}, 0)`; // sin abonos el resultado es NULL -> 0
export const totalSql = sql`${pago.costoServicio} + ${pago.costoCompra}`;
export const estadoSql = sql<'Pendiente' | 'Parcial' | 'Pagado'>`case
  when ${pagadoSql} = 0 then 'Pendiente'
  when ${pagadoSql} < ${totalSql} then 'Parcial'
  else 'Pagado' end`;

const columnas = {
    idPago: pago.idPago,
    idPaquete: pago.idPaquete,
    codigoRastreo: paquete.codigoRastreo,
    tiendaProcedencia: paquete.tiendaProcedencia,
    clienteNombre: cliente.nombre,
    costoServicio: pago.costoServicio,
    costoCompra: pago.costoCompra,
    total: sql<string>`${totalSql}`,
    montoPagado: sql<string>`${pagadoSql}`,
    saldoPendiente: sql<string>`greatest(${totalSql} - ${pagadoSql}, 0)`,
    estadoPago: estadoSql,
    // ISO en UTC: el texto crudo de PostgreSQL ("2026-10-19 23:39:00+00") no lo entienden todos los navegadores.
    ultimoPago: sql<string | null>`to_char(${resumen.ultima} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    idCanalPago: canalIdSql,
    canal: canalPago.nombre,
    idMetodoPago: metodoIdSql,
    metodo: metodoPago.nombre,
    ultimoAbonoMonto: sql<string | null>`${ultimoAbono.monto}`, // null si aún no hay abonos
    fechaCreacion: pago.fechaCreacion,
};

const consultaPagos = (donde?: SQL) =>
    db
        .select(columnas)
        .from(pago)
        .innerJoin(paquete, eq(pago.idPaquete, paquete.idPaquete))
        .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
        .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
        .leftJoin(resumen, eq(resumen.idPago, pago.idPago)) // LEFT: un pago sin abonos debe aparecer
        .leftJoin(ultimoAbono, eq(ultimoAbono.idPago, pago.idPago))
        // Estos dos JOIN van DESPUÉS de ultimoAbono porque usan su resultado.
        .innerJoin(canalPago, eq(canalPago.id, canalIdSql))
        .innerJoin(metodoPago, eq(metodoPago.id, metodoIdSql))
        .where(donde);

export async function listarPagos({ pagina, q, filtro }: ListarPagos) {
  const donde = and(
    filtro === 'pendientes' ? sql`${pagadoSql} = 0` : undefined,
    filtro === 'parciales' ? sql`${pagadoSql} > 0 and ${pagadoSql} < ${totalSql}` : undefined,
    filtro === 'recientes' ? sql`${pagadoSql} > 0` : undefined, // solo pagos con dinero recibido
    filtroTexto(
      q,
      [
        paquete.codigoRastreo,
        viaje.codigoViaje,
        paquete.tiendaProcedencia,
        cliente.nombre,
        cliente.correo,
        canalPago.nombre,
        metodoPago.nombre,
        estadoSql,
      ],
      [cliente.telefono],
    ),
  );

  // El conteo necesita los mismos JOIN que la lista (si no, el total no coincidiría).
  const [[conteo], datos] = await Promise.all([
    db
      .select({ total: count() })
      .from(pago)
      .innerJoin(paquete, eq(pago.idPaquete, paquete.idPaquete))
      .innerJoin(cliente, eq(paquete.idCliente, cliente.idCliente))
      .leftJoin(viaje, eq(paquete.idViaje, viaje.idViaje))
      .leftJoin(resumen, eq(resumen.idPago, pago.idPago))
      .leftJoin(ultimoAbono, eq(ultimoAbono.idPago, pago.idPago))
      .innerJoin(canalPago, eq(canalPago.id, canalIdSql))
      .innerJoin(metodoPago, eq(metodoPago.id, metodoIdSql))
      .where(donde),
    consultaPagos(donde)
      .orderBy(
        ...(filtro === 'recientes'
          ? [desc(resumen.ultima), desc(pago.idPago)]
          : [desc(pago.fechaCreacion), desc(pago.idPago)]),
      )
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
  ]);
  return { datos, paginacion: armarPaginacion(pagina, conteo?.total ?? 0) };
}

export async function obtenerPago(id: number) {
    const [p] = await consultaPagos(eq(pago.idPago, id)).limit(1);
    if (!p) throw noEncontrado('Pago');
    return p;
}

// Detalle = el pago + cada abono (cuánto, cuándo, cómo y quién lo registró).
export async function detallePago(id: number) {
    const p = await obtenerPago(id);
    const abonos = await db
        .select({
            idAbono: abono.idAbono,
            monto: abono.monto,
            fechaPago: abono.fechaPago,
            idCanalPago: abono.idCanalPago,
            canal: canalPago.nombre,
            idMetodoPago: abono.idMetodoPago,
            metodo: metodoPago.nombre,
            registradoPor: usuario.usuario,
        })
        .from(abono)
        .innerJoin(canalPago, eq(abono.idCanalPago, canalPago.id))
        .innerJoin(metodoPago, eq(abono.idMetodoPago, metodoPago.id))
        .innerJoin(usuario, eq(abono.idUsuario, usuario.idUsuario))
        .where(eq(abono.idPago, id))
        .orderBy(asc(abono.fechaPago), asc(abono.idAbono));
    return { ...p, abonos };
}

// --- Validaciones con mensaje claro ---
// exigirReales = true -> rechaza "Por definir" (un abono es dinero ya recibido, tiene canal y método reales).
async function validarCanalMetodo(idCanal: number | undefined, idMetodo: number | undefined, exigirReales: boolean) {
    if (idCanal !== undefined) {
        const [c] = await db.select({ nombre: canalPago.nombre }).from(canalPago).where(eq(canalPago.id, idCanal)).limit(1);
        if (!c) throw new AppError(400, 'CANAL_INVALIDO', 'El canal de cobro seleccionado no existe');
        if (exigirReales && c.nombre === POR_DEFINIR)
            throw new AppError(400, 'CANAL_POR_DEFINIR', 'Para registrar un cobro elige el canal real (no "Por definir")');
    }
    if (idMetodo !== undefined) {
        const [m] = await db.select({ nombre: metodoPago.nombre }).from(metodoPago).where(eq(metodoPago.id, idMetodo)).limit(1);
        if (!m) throw new AppError(400, 'METODO_INVALIDO', 'El método de pago seleccionado no existe');
        if (exigirReales && m.nombre === POR_DEFINIR)
            throw new AppError(400, 'METODO_POR_DEFINIR', 'Para registrar un cobro elige el método real (no "Por definir")');
    }
}

// Bloquea la fila del pago (FOR UPDATE) y calcula su total y lo cobrado, en centavos.
// Mientras dure la transacción nadie más puede modificar este pago: dos abonos simultáneos
// no pueden pasarse del saldo. `excluirAbono` sirve al editar un abono (no contarlo dos veces).
async function bloquearPago(tx: Tx, idPago: number, excluirAbono?: number) {
    const [p] = await tx
        .select({ servicio: pago.costoServicio, compra: pago.costoCompra })
        .from(pago)
        .where(eq(pago.idPago, idPago))
        .for('update');
    if (!p) throw noEncontrado('Pago');
    const [a] = await tx
        .select({ pagado: sql<string>`coalesce(sum(${abono.monto}), 0)` })
        .from(abono)
        .where(and(eq(abono.idPago, idPago), excluirAbono === undefined ? undefined : ne(abono.idAbono, excluirAbono)));
    return {
        servicio: p.servicio,
        compra: p.compra,
        total: centavos(p.servicio) + centavos(p.compra),
        pagado: centavos(a?.pagado ?? '0'),
    };
}

// Crea la deuda y, si el cliente ya pagó algo, su primer abono. Todo en UNA transacción.
export async function crearPago(d: DatosPago, idUsuario: number) {
    const total = centavos(d.costoServicio) + centavos(d.costoCompra);
    const inicial = centavos(d.importeCancelado);
    if (total <= 0) throw new AppError(400, 'TOTAL_INVALIDO', 'El total (servicio + compra) debe ser mayor a 0');
    if (inicial > total) throw new AppError(400, 'ABONO_EXCEDE_TOTAL', `El importe cancelado supera el total ($${aDinero(total)})`);

    if ((await db.$count(paquete, eq(paquete.idPaquete, d.idPaquete))) === 0)
        throw new AppError(400, 'PAQUETE_INVALIDO', 'El paquete seleccionado no existe');
    await validarCanalMetodo(d.idCanalPago, d.idMetodoPago, inicial > 0);

    const id = await db.transaction(async (tx) => {
        // Solo puede haber un pago por paquete (UNIQUE). `onConflictDoNothing` evita el error crudo
        // de la BD y nos deja dar un mensaje claro.
        const [creado] = await tx
            .insert(pago)
            .values({
                idPaquete: d.idPaquete,
                costoServicio: d.costoServicio,
                costoCompra: d.costoCompra,
                idCanalPago: d.idCanalPago,
                idMetodoPago: d.idMetodoPago,
            })
            .onConflictDoNothing({ target: pago.idPaquete })
            .returning({ id: pago.idPago });
        if (!creado) throw conflicto('Ese paquete ya tiene un pago registrado');

        if (inicial > 0) {
            await tx.insert(abono).values({
                idPago: creado.id,
                monto: d.importeCancelado,
                ...(d.fechaPago ? { fechaPago: d.fechaPago } : {}), // sin fecha, la BD pone la actual
                idCanalPago: d.idCanalPago,
                idMetodoPago: d.idMetodoPago,
                idUsuario,
            });
        }
        return creado.id;
    });
    return obtenerPago(id);
}

export async function actualizarPago(id: number, cambios: CambiosPago) {
    await validarCanalMetodo(cambios.idCanalPago, cambios.idMetodoPago, false);
    await db.transaction(async (tx) => {
        const actual = await bloquearPago(tx, id);
        const nuevoTotal =
            centavos(cambios.costoServicio ?? actual.servicio) + centavos(cambios.costoCompra ?? actual.compra);
        if (nuevoTotal <= 0) throw new AppError(400, 'TOTAL_INVALIDO', 'El total (servicio + compra) debe ser mayor a 0');
        // Si ya se cobró más que el nuevo total, el pago quedaría "sobrepagado": lo impedimos.
        if (nuevoTotal < actual.pagado)
            throw new AppError(409, 'TOTAL_MENOR_A_LO_PAGADO', `El total no puede ser menor a lo ya cobrado ($${aDinero(actual.pagado)})`);
        await tx.update(pago).set(cambios).where(eq(pago.idPago, id));
    });
    return obtenerPago(id);
}

export async function crearAbono(idPago: number, d: DatosAbono, idUsuario: number) {
    await validarCanalMetodo(d.idCanalPago, d.idMetodoPago, true);
    await db.transaction(async (tx) => {
        const { total, pagado } = await bloquearPago(tx, idPago);
        const saldo = total - pagado;
        if (saldo <= 0) throw conflicto('Este pago ya está completo');
        if (centavos(d.monto) > saldo)
            throw new AppError(409, 'ABONO_EXCEDE_SALDO', `El monto supera el saldo pendiente ($${aDinero(saldo)})`);

        await tx.insert(abono).values({
            idPago,
            monto: d.monto,
            ...(d.fechaPago ? { fechaPago: d.fechaPago } : {}),
            idCanalPago: d.idCanalPago,
            idMetodoPago: d.idMetodoPago,
            idUsuario,
        });
    });
    return detallePago(idPago);
}

export async function actualizarAbono(idPago: number, idAbono: number, cambios: CambiosAbono) {
    await validarCanalMetodo(cambios.idCanalPago, cambios.idMetodoPago, true);
    await db.transaction(async (tx) => {
        const { total, pagado: otros } = await bloquearPago(tx, idPago, idAbono); // lo cobrado SIN este abono
        const [actual] = await tx
            .select({ monto: abono.monto })
            .from(abono)
            .where(and(eq(abono.idAbono, idAbono), eq(abono.idPago, idPago))) // el abono debe ser de ESE pago
            .limit(1);
        if (!actual) throw noEncontrado('Abono');

        if (otros + centavos(cambios.monto ?? actual.monto) > total)
            throw new AppError(409, 'ABONO_EXCEDE_SALDO', `El monto supera lo que falta por cobrar ($${aDinero(total - otros)})`);
        await tx.update(abono).set(cambios).where(eq(abono.idAbono, idAbono));
    });
    return detallePago(idPago);
}

// Eliminar un abono baja lo cobrado, así que no puede crear sobrepago: no necesita bloqueo.
export async function eliminarAbono(idPago: number, idAbono: number) {
    const borrados = await db
        .delete(abono)
        .where(and(eq(abono.idAbono, idAbono), eq(abono.idPago, idPago)))
        .returning({ id: abono.idAbono });
    if (borrados.length === 0) throw noEncontrado('Abono');
    return detallePago(idPago);
}

// Elimina pagos; sus abonos se van con ellos (cascade). Los paquetes NO se tocan.
export async function eliminarPagos(ids: number[]) {
    const borrados = await db.delete(pago).where(inArray(pago.idPago, ids)).returning({ id: pago.idPago });
    if (borrados.length === 0) throw noEncontrado('Pago');
    return borrados.length;
}