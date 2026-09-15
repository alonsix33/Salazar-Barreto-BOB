/**
 * El saldo de la cuenta no baja por un gasto anual que todavía no salió del
 * banco. `saldo.ts`, `deltaDe`/`reservaAnualDe`.
 *
 * Encontrado en producción: comparando el saldo calculado contra el estado de
 * cuenta real de agosto de 2026, la app daba S/ 267.31 y el banco tenía
 * S/ 4 098.35. La causa: `gastado(mes)` era `totalMes` a secas, así que la
 * doceava parte de los contratos anuales (bomba, cisterna, cerco, extintor —
 * S/ 339.58/mes en la semilla) se restaba del saldo cada mes como si el dinero
 * hubiera salido del banco, cuando en realidad se queda en la cuenta hasta que
 * el gasto real ocurre.
 */
import { describe, expect, it } from 'vitest'
import { serieSaldo, type MesConPagos } from '../saldo'
import { calcularMesSemilla } from './ayuda'
import { round2 } from '../redondeo'
import { GASTOS_FIJOS } from '../constantes'
import type { MesId } from '../tipos'

const MES: MesId = '2026-06'

/** La reserva anual de la semilla: los cuatro conceptos marcados `anual`. */
const RESERVA_ANUAL = round2(
  GASTOS_FIJOS.filter((g) => g.anual).reduce((s, g) => s + (g.monto ?? 0), 0),
)

function pagosTodosAlDia(mesId: MesId): MesConPagos['pagos'] {
  const pagos: MesConPagos['pagos'] = {}
  for (const d of ['101', '201', '202', '301', '401', '501', '502'] as const) {
    pagos[d] = { estado: 'confirmado', fecha: `${mesId}-28` }
  }
  return pagos
}

describe('la reserva de los gastos anuales no sale del banco hasta que el gasto real ocurre', () => {
  it('la semilla sí tiene conceptos anuales: si no, este archivo no prueba nada', () => {
    expect(RESERVA_ANUAL).toBeGreaterThan(0)
  })

  it('gastado es menor que totalMes, por exactamente la reserva anual', () => {
    const r = calcularMesSemilla(MES)
    if (!r.valido) throw new Error('la base del test no es válida')
    const m: MesConPagos = { mesId: MES, resultado: r, pagos: pagosTodosAlDia(MES) }
    const [fila] = serieSaldo([m], 0)
    expect(fila!.gastado).toBe(round2(r.totalMes - RESERVA_ANUAL))
  })

  it('todos pagando justo, el saldo del mes sube: no queda en cero', () => {
    const r = calcularMesSemilla(MES)
    if (!r.valido) throw new Error('la base del test no es válida')
    const m: MesConPagos = { mesId: MES, resultado: r, pagos: pagosTodosAlDia(MES) }
    const [fila] = serieSaldo([m], 0)
    // Todos pagaron exactamente su cuota: lo recibido es la suma de las
    // cuotas, que ya está redondeada a céntimos por `calcularMes`.
    expect(fila!.recibido).toBe(r.sumaCuotas)
    // Exacto contra la reserva, no un `toBeGreaterThan` de manga ancha: con
    // esa versión floja, la primera redacción de este test se quedó en verde
    // incluso con el defecto reinyectado (`gastado = totalMes`), porque
    // `recibido ≈ totalMes` por el propio cuadre del mes y la resta daba un
    // par de céntimos positivos igual. La prueba negativa lo encontró.
    expect(fila!.delta).toBe(round2(r.sumaCuotas - round2(r.totalMes - RESERVA_ANUAL)))
    expect(fila!.saldo).toBe(fila!.delta) // saldoInicial = 0
  })

  it('el gasto real anual, cuando por fin ocurre, sí resta del saldo, completo', () => {
    const sinExtra = calcularMesSemilla(MES)
    const conExtra = calcularMesSemilla(MES, {
      extras: [{ tipo: 'gasto', concepto: 'Mantenimiento de la cisterna 2026', monto: 600 }],
    })
    if (!sinExtra.valido || !conExtra.valido) throw new Error('la base del test no es válida')

    const filaSinExtra = serieSaldo(
      [{ mesId: MES, resultado: sinExtra, pagos: pagosTodosAlDia(MES) }],
      0,
    )[0]!
    const filaConExtra = serieSaldo(
      [{ mesId: MES, resultado: conExtra, pagos: pagosTodosAlDia(MES) }],
      0,
    )[0]!

    // El extra no lleva `anual`: es un gasto real que sí sale del banco. La
    // reserva de los otros cuatro conceptos (bomba, cerco, extintor) se sigue
    // quedando afuera igual, así que la única diferencia entre gastar con y
    // sin el extra es el extra mismo.
    expect(round2(filaConExtra.gastado - filaSinExtra.gastado)).toBe(600)
  })
})
