/**
 * Leer de la base todo lo que el motor necesita para calcular un mes.
 *
 * Este módulo es el único que sabe a la vez de Prisma y del motor. Todo lo de
 * arriba —rutas, servicios, pantallas— consume `ResultadoMes`, que es puro.
 */

import { calcularMes } from '@/lib/calculo/calcularMes'
import { mesAnterior } from '@/lib/calculo/mes'
import type {
  DptoId,
  EntradasMes,
  Extra,
  GastoFijo,
  Lecturas,
  MesId,
  Overrides,
  PagosMes,
  Recibo,
  ResultadoMes,
} from '@/lib/calculo/tipos'
import { almanaque } from './almanaque'
import { extraDeLaFila, fijosDeLasFilas, lavadoDeLasFilas, pagoDeLaFila } from './filas'
import { aNumero, aNumeroObligatorio } from './decimal'
import { prisma } from './prisma'

/**
 * El cliente con el que leer: el normal, o el de una transacción abierta.
 *
 * Existe porque `corregirMes` tiene que **recalcular el mes con lo que acaba de
 * escribir**, y esas escrituras todavía no están confirmadas: leerlas con el
 * cliente de fuera devuelve los valores viejos. Antes eso se resolvía con una
 * segunda copia de estas funciones dentro del servicio, y las dos copias se
 * separaron: una heredaba la marca del lavado del mes anterior y la otra no, así
 * que el aviso que recibían los siete —«el 401 pasó de X a Y»— citaba una Y que
 * la app no cobraba. Una sola calculadora, y se le pasa el cliente.
 */
export type Lector = Pick<
  typeof prisma,
  'lectura' | 'recibo' | 'gastoFijo' | 'gastoExtra' | 'reasignacionAgua' | 'pago'
>

/** Las lecturas de un mes, por departamento. */
export async function lecturasDe(mes: MesId, db: Lector = prisma): Promise<Lecturas> {
  const filas = await db.lectura.findMany({ where: { mes } })
  const salida: Lecturas = {}
  for (const f of filas) salida[f.dptoId as DptoId] = aNumeroObligatorio(f.valor)
  return salida
}

/** El recibo de un mes, o `null` si todavía no se registró. */
export async function reciboDe(mes: MesId, db: Lector = prisma): Promise<Recibo | null> {
  const r = await db.recibo.findUnique({ where: { mes } })
  if (!r) return null
  return {
    aguaM3: r.aguaM3,
    aguaMonto: aNumeroObligatorio(r.aguaMonto),
    luz: aNumeroObligatorio(r.luz),
    descuento: aNumero(r.descuento),
  }
}

/**
 * Los gastos fijos vigentes en un mes.
 *
 * Un cambio de monto no reescribe el pasado: para cada concepto se toma la fila
 * con el `vigenteDesde` más alto que no pase del mes pedido.
 */
export async function fijosVigentesEn(mes: MesId, db: Lector = prisma): Promise<GastoFijo[]> {
  const filas = await db.gastoFijo.findMany({
    where: { vigenteDesde: { lte: mes } },
    orderBy: [{ orden: 'asc' }, { vigenteDesde: 'asc' }],
  })
  // La regla —cuál gana de cada concepto— vive en `filas.ts`, una sola vez.
  return fijosDeLasFilas(
    filas.map((f) => ({ ...f, monto: aNumero(f.monto) })),
    mes,
  )
}

/** Los gastos extraordinarios y créditos de un mes. */
export async function extrasDe(mes: MesId, db: Lector = prisma): Promise<Extra[]> {
  const filas = await db.gastoExtra.findMany({
    where: { mes },
    // `id` de desempate: dos gastos creados en el mismo milisegundo salían en
    // el orden que decidiera Postgres, y el orden de los extras mueve céntimos.
    orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
  })
  return filas.map((f) => extraDeLaFila({ ...f, monto: aNumeroObligatorio(f.monto) }))
}

/**
 * Los m³ del lavado que aplican a un mes.
 *
 * 0 si la casilla del paso 5 está desmarcada para ese mes. Si no hay marca
 * explícita, se hereda: viene marcada si estuvo activa el mes anterior.
 */
export async function lavadoM3En(mes: MesId, db: Lector = prisma): Promise<number> {
  const filas = await db.reasignacionAgua.findMany({
    /**
     * Con orden, y el mismo que usa la ruta que las edita
     * (`PUT /api/reasignaciones`). Antes era un `findFirst` sin `orderBy`: con
     * una sola reasignación —que es lo que hay— da igual, pero el día que haya
     * dos leería una al azar, y podría no ser la que se escribe.
     */
    orderBy: [{ desde: 'desc' }, { creadoEn: 'desc' }],
    include: { activaEn: true },
  })
  // La herencia y el valor congelado viven en `filas.ts`, una sola vez.
  return lavadoDeLasFilas(
    filas.map((r) => ({
      m3: aNumeroObligatorio(r.m3),
      desde: r.desde,
      activaEn: r.activaEn.map((a) => ({ mes: a.mes, activa: a.activa, m3: aNumero(a.m3) })),
    })),
    mes,
  )
}

/**
 * Los pagos de un mes, por departamento.
 *
 * Sin `db`, sale de la foto del edificio: una tanda de consultas para todos los
 * meses en vez de una por mes. Con `db` —dentro de una transacción— se lee de
 * la base, que es lo que necesita quien acaba de escribir.
 */
export async function pagosDe(mes: MesId, db?: Lector): Promise<PagosMes> {
  if (!db) return (await almanaque()).pagosDe(mes)
  const filas = await db.pago.findMany({ where: { mes } })
  const salida: PagosMes = {}
  for (const f of filas) {
    salida[f.dptoId as DptoId] = pagoDeLaFila({
      ...f,
      fecha: f.fecha.toISOString().slice(0, 10),
      monto: aNumero(f.monto),
    })
  }
  return salida
}

/** Todo lo que el motor necesita de un mes, leído de la base. */
export async function entradasDeMes(mes: MesId, db: Lector = prisma): Promise<EntradasMes> {
  const [recibo, lecturas, lecturasAnteriores, fijos, extras, lavadoM3] = await Promise.all([
    reciboDe(mes, db),
    lecturasDe(mes, db),
    lecturasDe(mesAnterior(mes), db),
    fijosVigentesEn(mes, db),
    extrasDe(mes, db),
    lavadoM3En(mes, db),
  ])
  return { mesId: mes, recibo, lecturas, lecturasAnteriores, fijos, extras, lavadoM3 }
}

/**
 * El mes ya calculado. Es lo que consumen las pantallas y la API.
 *
 * El camino normal —sin `db` y sin overrides— sale de la foto del edificio, que
 * ya trae todos los meses calculados con este mismo motor. Pintar Historial
 * hacía 66 consultas para llegar a lo mismo.
 *
 * Con `db` se calcula contra la base: es el camino de las transacciones, donde
 * hay que ver lo que se acaba de escribir y todavía no está confirmado. Con
 * overrides, también: la foto se guarda sin ellos.
 */
export async function resultadoDeMes(
  mes: MesId,
  ov: Overrides = {},
  db?: Lector,
): Promise<ResultadoMes> {
  if (!db && Object.keys(ov).length === 0) return (await almanaque()).resultadoDe(mes)
  return calcularMes(await entradasDeMes(mes, db ?? prisma), ov)
}
