/**
 * El saldo y el balance por departamento reflejan lo que entró **de verdad**.
 *
 * Antes un pago valía siempre la cuota exacta. Ahora un vecino puede pagar de
 * más (queda a favor y arrastra), de menos (le falta), o por adelantado. La
 * cuenta conjunta y el balance de cada uno tienen que decir la verdad.
 */
import { describe, expect, it } from 'vitest'
import { balancePorDpto, serieSaldo, type MesConPagos } from '../saldo'
import { calcularMesSemilla } from './ayuda'
import { round2 } from '../redondeo'
import type { MesId, Pago } from '../tipos'

const MES: MesId = '2026-06'
const r = calcularMesSemilla(MES)
if (!r.valido) throw new Error('la base del test no es válida')

const cuota101 = r.cuotas['101'].total

/** Un mes con todos pagando justo, salvo los que se pasen por parámetro. */
function mesConPagos(salvo: Partial<Record<string, Pago>> = {}): MesConPagos {
  const pagos: MesConPagos['pagos'] = {}
  for (const d of ['101', '201', '202', '301', '401', '501', '502'] as const) {
    pagos[d] = salvo[d] ?? { estado: 'confirmado', fecha: '2026-06-30' }
  }
  return { mesId: MES, resultado: r, pagos }
}

describe('balance por departamento', () => {
  it('pagar justo deja el balance en cero', () => {
    const b = balancePorDpto([mesConPagos()])
    expect(b['101']).toBe(0)
  })

  it('pagar de más deja saldo a favor', () => {
    const b = balancePorDpto([
      mesConPagos({ '101': { estado: 'confirmado', fecha: '2026-06-30', monto: round2(cuota101 + 100) } }),
    ])
    expect(b['101']).toBe(100)
  })

  it('pagar de menos deja lo que falta, en negativo', () => {
    const b = balancePorDpto([
      mesConPagos({ '101': { estado: 'confirmado', fecha: '2026-06-30', monto: round2(cuota101 - 40) } }),
    ])
    expect(b['101']).toBe(-40)
  })

  it('un mes publicado sin pago confirmado cuenta como cuota en contra', () => {
    const b = balancePorDpto([mesConPagos({ '101': { estado: 'aviso', fecha: '2026-06-30' } })])
    expect(b['101']).toBe(round2(-cuota101))
  })

  it('el saldo a favor arrastra: un adelanto en un mes cubre el siguiente', () => {
    // En junio paga el doble de su cuota; en julio no paga nada. El balance
    // acumulado debe quedar en 0: el adelanto cubrió julio.
    const julio = calcularMesSemilla('2026-07')
    if (!julio.valido) throw new Error('julio no válido')
    const cuota101Jul = julio.cuotas['101'].total
    const jun: MesConPagos = {
      mesId: MES,
      resultado: r,
      pagos: { '101': { estado: 'confirmado', fecha: '2026-06-30', monto: round2(cuota101 + cuota101Jul) } },
    }
    const jul: MesConPagos = {
      mesId: '2026-07',
      resultado: julio,
      pagos: { '101': { estado: 'aviso', fecha: '2026-07-30' } },
    }
    const b = balancePorDpto([jun, jul])
    expect(b['101']).toBe(0)
  })
})

describe('la cuenta conjunta usa el monto real', () => {
  it('un pago de más sube el recibido del mes por su monto, no por la cuota', () => {
    const exacto = serieSaldo([mesConPagos()], 0)
    const conExtra = serieSaldo(
      [mesConPagos({ '101': { estado: 'confirmado', fecha: '2026-06-30', monto: round2(cuota101 + 100) } })],
      0,
    )
    expect(round2(conExtra[0]!.recibido - exacto[0]!.recibido)).toBe(100)
    expect(round2(conExtra[0]!.saldo - exacto[0]!.saldo)).toBe(100)
  })
})
