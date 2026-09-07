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
  const porConcepto = new Map<string, (typeof filas)[number]>()
  for (const f of filas) porConcepto.set(f.concepto, f) // la última gana: es la más reciente
  return [...porConcepto.values()]
    .sort((a, b) => a.orden - b.orden || a.concepto.localeCompare(b.concepto))
    .map((f) => ({
      concepto: f.concepto,
      monto: aNumero(f.monto),
      ...(f.anual ? { anual: true } : {}),
      ...(f.monto === null ? { porConfirmar: true } : {}),
    }))
}

/** Los gastos extraordinarios y créditos de un mes. */
export async function extrasDe(mes: MesId, db: Lector = prisma): Promise<Extra[]> {
  const filas = await db.gastoExtra.findMany({ where: { mes }, orderBy: { creadoEn: 'asc' } })
  return filas.map((f): Extra =>
    f.tipo === 'credito'
      ? { tipo: 'credito', concepto: f.concepto, monto: aNumeroObligatorio(f.monto), dpto: f.dptoId as DptoId }
      : { tipo: 'gasto', concepto: f.concepto, monto: aNumeroObligatorio(f.monto) },
  )
}

/**
 * Los m³ del lavado que aplican a un mes.
 *
 * 0 si la casilla del paso 5 está desmarcada para ese mes. Si no hay marca
 * explícita, se hereda: viene marcada si estuvo activa el mes anterior.
 */
export async function lavadoM3En(mes: MesId, db: Lector = prisma): Promise<number> {
  const reasignacion = await db.reasignacionAgua.findFirst({
    where: { desde: { lte: mes } },
    include: { activaEn: true },
  })
  if (!reasignacion) return 0

  /**
   * Los m³ de **este** mes, no los de hoy.
   *
   * Si el mes tiene un valor congelado, manda ese: se grabó al publicarlo y es
   * con el que se calcularon las siete cuotas que la gente ya vio. Sin esta
   * línea, subir el consumo del lavado de 1.50 a 3.00 movía la cuota del 401 en
   * junio de 2026 en S/ 6.25 —un mes cerrado y avisado— mientras el aviso a los
   * siete decía que los meses cerrados no se tocan.
   */
  const vigente = (congelado: unknown) =>
    congelado === null || congelado === undefined
      ? aNumeroObligatorio(reasignacion.m3)
      : aNumeroObligatorio(congelado as typeof reasignacion.m3)

  const marcaDelMes = reasignacion.activaEn.find((a) => a.mes === mes)
  if (marcaDelMes) return marcaDelMes.activa ? vigente(marcaDelMes.m3) : 0
  // Sin marca explícita: se hereda la del mes anterior, y si tampoco la hay,
  // se asume activa desde la fecha en que empieza a aplicar. El valor, en
  // cambio, no se hereda: un mes sin cerrar sigue el actual.
  const anterior = reasignacion.activaEn.find((a) => a.mes === mesAnterior(mes))
  if (anterior) return anterior.activa ? aNumeroObligatorio(reasignacion.m3) : 0
  return aNumeroObligatorio(reasignacion.m3)
}

/** Los pagos de un mes, por departamento. */
export async function pagosDe(mes: MesId, db: Lector = prisma): Promise<PagosMes> {
  const filas = await db.pago.findMany({ where: { mes } })
  const salida: PagosMes = {}
  for (const f of filas) {
    salida[f.dptoId as DptoId] = {
      estado: f.estado,
      fecha: f.fecha.toISOString().slice(0, 10),
      monto: aNumero(f.monto),
      op: f.operacion,
      texto: f.texto,
    }
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

/** El mes ya calculado. Es lo que consumen las pantallas y la API. */
export async function resultadoDeMes(
  mes: MesId,
  ov: Overrides = {},
  db: Lector = prisma,
): Promise<ResultadoMes> {
  return calcularMes(await entradasDeMes(mes, db), ov)
}
