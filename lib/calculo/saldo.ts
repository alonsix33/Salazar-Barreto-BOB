/**
 * El saldo de la cuenta conjunta. `01-reglas-de-negocio.md` §6.
 *
 * ```
 * recibido(mes) = Σ lo que entró de verdad de los CONFIRMADOS
 * gastado(mes)  = totalMes
 * delta(mes)    = recibido − gastado
 * saldo(mes)    = saldo(mes-1) + delta(mes)
 * ```
 *
 * «Lo que entró de verdad» es el monto verificado contra el banco, y su cuota
 * exacta cuando no se anotó otro monto (el caso normal: pagó justo). Un pago de
 * más o de menos mueve la cuenta por su monto real, no por la cuota teórica.
 *
 * **Solo cuentan los pagos confirmados.** Un pago avisado por el vecino pero no
 * verificado contra el banco no suma al saldo.
 */

import { DPTOS, SALDO_BASE } from './constantes'
import { mesCorto } from './mes'
import { round2 } from './redondeo'
import type { DptoId, FilaSaldo, MesId, PagosMes, ResultadoMes } from './tipos'

/** Un mes con su cálculo y sus pagos, que es lo que la serie necesita. */
export interface MesConPagos {
  readonly mesId: MesId
  readonly resultado: ResultadoMes | null
  readonly pagos: PagosMes
}

interface Delta {
  recibido: number
  gastado: number
  delta: number
}

/**
 * Lo que un departamento aportó a la cuenta en un mes: **el monto que entró de
 * verdad** si está confirmado, y si no se anotó el monto, su cuota exacta (que
 * es el caso normal). Un pago solo avisado no aporta: es la palabra del vecino.
 */
function aportadoPor(pago: MesConPagos['pagos'][DptoId], cuota: number): number {
  if (!pago || pago.estado !== 'confirmado') return 0
  return round2(pago.monto ?? cuota)
}

function deltaDe(m: MesConPagos): Delta {
  const c = m.resultado
  if (!c || !c.valido) return { recibido: 0, gastado: 0, delta: 0 }
  const recibido = round2(
    DPTOS.reduce((s, d) => s + aportadoPor(m.pagos[d.id], c.cuotas[d.id].total), 0),
  )
  return { recibido, gastado: c.totalMes, delta: round2(recibido - c.totalMes) }
}

/**
 * El balance de cada departamento, **acumulado hacia adelante**.
 *
 * Por cada mes cerrado y confirmado: lo que pagó menos lo que le tocaba. Un
 * saldo **positivo** es plata a favor (pagó de más o por adelantado) que
 * arrastra al mes siguiente; uno **negativo** es lo que todavía le falta poner.
 * La cuota del mes no se toca: esto es aparte, para que «te toca pagar» pueda
 * descontar lo que ya trae a favor.
 *
 * Un mes sin pago confirmado cuenta como cuota **no** aportada (balance en
 * contra por esa cuota): es la verdad, no un castigo. La interfaz lo dice en
 * suave, sin rojo ni la palabra «deuda».
 */
export function balancePorDpto(meses: readonly MesConPagos[]): Record<DptoId, number> {
  const balance = Object.fromEntries(DPTOS.map((d) => [d.id, 0])) as Record<DptoId, number>
  for (const m of meses) {
    const c = m.resultado
    if (!c || !c.valido) continue
    for (const d of DPTOS) {
      // Lo que puso menos lo que le tocaba. Sin pago confirmado, puso 0 y le
      // falta la cuota entera.
      const aporte = aportadoPor(m.pagos[d.id], c.cuotas[d.id].total)
      balance[d.id] = round2((balance[d.id] ?? 0) + aporte - c.cuotas[d.id].total)
    }
  }
  return balance
}

/**
 * Serie del saldo mes a mes, **acumulando hacia adelante** desde el saldo
 * inicial real de la cuenta.
 *
 * Es lo que usa la aplicación. El prototipo derivaba el saldo inicial hacia
 * atrás para que el último mes cerrara en `SALDO_BASE`; eso era una muleta para
 * no tener backend, y no se copia (ver `serieSaldoDerivada`).
 *
 * @param meses        En orden cronológico ascendente.
 * @param saldoInicial El saldo real de la cuenta **antes** del primer mes de la lista.
 */
export function serieSaldo(meses: readonly MesConPagos[], saldoInicial: number): FilaSaldo[] {
  let saldo = round2(saldoInicial)
  return meses.map((m) => {
    const d = deltaDe(m)
    saldo = round2(saldo + d.delta)
    return {
      mes: m.mesId,
      corto: mesCorto(m.mesId),
      recibido: d.recibido,
      gastado: d.gastado,
      delta: d.delta,
      saldo,
    }
  })
}

/**
 * La serie tal como la deriva el prototipo: hacia atrás, para que el último mes
 * cierre en `SALDO_BASE`.
 *
 * **No la usa ninguna pantalla ni ningún endpoint.** Existe solo para poder
 * comparar la serie del motor contra la del mockup en los tests de fidelidad de
 * la Fase 1. Si aparece importada fuera de un test, es un bug.
 */
export function serieSaldoDerivada(
  meses: readonly MesConPagos[],
  saldoBase: number = SALDO_BASE,
): FilaSaldo[] {
  const deltas = meses.map(deltaDe)
  const totalDelta = deltas.reduce((s, x) => s + x.delta, 0)
  const inicial = round2(saldoBase - totalDelta)
  let saldo = inicial
  return meses.map((m, n) => {
    saldo = round2(saldo + deltas[n]!.delta)
    return {
      mes: m.mesId,
      corto: mesCorto(m.mesId),
      recibido: deltas[n]!.recibido,
      gastado: deltas[n]!.gastado,
      delta: deltas[n]!.delta,
      saldo,
    }
  })
}

/** La fila de un mes dentro de una serie ya calculada. */
export function saldoAl(serie: readonly FilaSaldo[], mesId: MesId): FilaSaldo | null {
  return serie.find((x) => x.mes === mesId) ?? null
}
