import { describe, expect, it } from 'vitest'
import { aporteDeFila, estadoCuota, nadaPendiente } from '../estados'

describe('un pago confirmado por menos de la cuota no está «al día»', () => {
  it('pagó 600 y la cuota es 800: falta una parte', () => {
    expect(estadoCuota({ estado: 'confirmado', monto: 600 }, 800)).toBe('falta-parte')
    expect(nadaPendiente({ estado: 'confirmado', monto: 600 }, 800)).toBe(false)
  })

  it('sin monto anotado pagó justo: al día', () => {
    expect(estadoCuota({ estado: 'confirmado', monto: null }, 800)).toBe('al-dia')
    expect(estadoCuota({ estado: 'confirmado' }, 800)).toBe('al-dia')
  })

  it('pagó justo o de más: al día', () => {
    expect(estadoCuota({ estado: 'confirmado', monto: 800 }, 800)).toBe('al-dia')
    expect(estadoCuota({ estado: 'confirmado', monto: 850 }, 800)).toBe('al-dia')
  })

  it('un centavo de menos ya es falta; una diferencia de redondeo no', () => {
    expect(estadoCuota({ estado: 'confirmado', monto: 799.99 }, 800)).toBe('falta-parte')
    expect(estadoCuota({ estado: 'confirmado', monto: 800.004 }, 800)).toBe('al-dia')
  })

  it('solo avisado sigue en verificación, aunque tenga monto', () => {
    expect(estadoCuota({ estado: 'aviso', monto: 100 }, 800)).toBe('en-verificacion')
  })

  it('un monto en cero confirmado con cuota en cero está al día', () => {
    expect(estadoCuota({ estado: 'confirmado', monto: 0 }, 0)).toBe('al-dia')
  })

  it('lo puesto sale del monto anotado, o de la cuota si pagó justo', () => {
    expect(aporteDeFila({ estado: 'confirmado', cuota: 800, monto: 600 })).toEqual({ puso: 600, completo: false })
    expect(aporteDeFila({ estado: 'confirmado', cuota: 800, monto: null })).toEqual({ puso: 800, completo: true })
    expect(aporteDeFila({ estado: 'aviso', cuota: 800, monto: null })).toBeNull()
    expect(aporteDeFila({ estado: null, cuota: 800, monto: null })).toBeNull()
  })
})
