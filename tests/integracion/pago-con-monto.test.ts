/**
 * Confirmar un pago con un monto distinto mueve el balance del depto.
 *
 * El vecino pagó de más (o de menos, o por adelantado). El admin lo confirma con
 * el monto real, y el balance del departamento —lo que arrastra a favor o en
 * contra— tiene que reflejarlo al céntimo.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes } from '@/lib/datos/mes'
import { balanceDelDpto } from '@/lib/datos/meses'
import { confirmarPago } from '@/lib/servicios/pagos'
import { round2 } from '@/lib/calculo/redondeo'
import { resembrar } from './entorno'

const MES = '2026-06'

describe('confirmar un pago con monto', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('un pago de más deja saldo a favor por la diferencia', async () => {
    // En la semilla el 501 no pagó junio: parte con junio en contra.
    const antes = await balanceDelDpto('501')
    const r = await resultadoDeMes(MES)
    if (!r.valido) throw new Error('junio no válido')
    const cuota = r.cuotas['501'].total

    await confirmarPago({ mes: MES, dpto: '501', monto: round2(cuota + 50) })

    const despues = await balanceDelDpto('501')
    // Pasó de deber su cuota (−cuota) a haber puesto cuota+50 (+50): el balance
    // sube cuota + 50.
    expect(round2(despues - antes)).toBe(round2(cuota + 50))
    // Y queda con 50 a favor de este mes (los meses previos los pagó justo).
    expect(despues).toBe(50)
  })

  it('confirmar por la cuota exacta (sin monto) deja el balance del mes en cero', async () => {
    const antes = await balanceDelDpto('501')
    const r = await resultadoDeMes(MES)
    if (!r.valido) throw new Error('junio no válido')
    const cuota = r.cuotas['501'].total

    await confirmarPago({ mes: MES, dpto: '501' })

    const despues = await balanceDelDpto('501')
    // De −cuota a 0 (puso justo): sube exactamente la cuota, y queda al día.
    expect(round2(despues - antes)).toBe(cuota)
    expect(despues).toBe(0)
  })
})
