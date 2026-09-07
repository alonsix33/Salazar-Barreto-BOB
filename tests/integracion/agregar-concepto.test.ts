/**
 * Se puede agregar un concepto fijo nuevo y entra al cálculo del mes.
 *
 * Es lo que permite inyectar la data real (Limpieza, un servicio nuevo, un
 * mantenimiento anual) sin tocar código: se crea desde el paso 4 y el motor lo
 * cobra desde ese mes.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes } from '@/lib/datos/mes'
import { guardarGastosFijos } from '@/lib/servicios/gastosFijos'
import { round2 } from '@/lib/calculo/redondeo'
import { cargarMesEnCurso, resembrar } from './entorno'

const MES = '2026-07'

describe('agregar un concepto fijo nuevo', () => {
  beforeEach(async () => {
    await resembrar()
    await cargarMesEnCurso(MES)
  })

  it('crea «Limpieza» 400 y el mantenimiento sube 400', async () => {
    const antes = await resultadoDeMes(MES)
    if (!antes.valido) throw new Error('base no válida')

    await guardarGastosFijos({ cambios: [{ concepto: 'Limpieza', monto: 400 }], vigenteDesde: MES })

    const despues = await resultadoDeMes(MES)
    if (!despues.valido) throw new Error('después no válido')

    const linea = despues.gastos.find((g) => g.concepto === 'Limpieza')
    expect(linea?.monto).toBe(400)
    expect(despues.baseMant).toBe(round2(antes.baseMant + 400))
    expect(despues.totalMes).toBe(round2(antes.totalMes + 400))
    expect(despues.cuadra).toBe(true)
  })

  it('un concepto anual entra con su marca', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Fumigación', monto: 120, anual: true }],
      vigenteDesde: MES,
    })
    const r = await resultadoDeMes(MES)
    const linea = r.valido ? r.gastos.find((g) => g.concepto === 'Fumigación') : undefined
    expect(linea?.anual).toBe(true)
  })
})
