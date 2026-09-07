/**
 * Los casos de `01-reglas-de-negocio.md` §10, tal como están escritos.
 *
 * El prompt los llama "los 14 casos" y el documento tiene en realidad **25
 * `assert()` repartidos en 9 escenarios**. Están los 25, uno por `it`, y cada
 * uno lleva encima la aserción literal del documento. Si uno falla, el port
 * tiene un bug: se arregla el port, no el test.
 */

import { describe, expect, it } from 'vitest'
import { DPTOS } from '../constantes'
import { calcularMesSemilla } from './ayuda'

const c = calcularMesSemilla('2026-06')

describe('01 §10 · mes normal, con lavado activo', () => {
  // assert(c.ajustado === false)
  it('no está en reparto ajustado', () => {
    expect(c.ajustado).toBe(false)
  })

  // assert(c.lavado === 1.5)
  it('el lavado son 1.5 m³', () => {
    expect(c.lavado).toBe(1.5)
  })

  // assert(c.cuadraAgua === true)
  it('el agua cuadra', () => {
    expect(c.cuadraAgua).toBe(true)
  })

  // assert(c.cuadraMes === true)
  it('el mes cuadra', () => {
    expect(c.cuadraMes).toBe(true)
  })

  // assert(c.cuotas['401'].m3 === c.consumos['401'] + 1.5)
  it('al 401 se le cobran sus m³ medidos más los 1.5 del lavado', () => {
    expect(c.cuotas['401'].m3).toBe(c.consumos['401'] + 1.5)
  })

  // assert(Math.abs(c.sumaAgua + c.montoComun - c.facturaAgua) < 0.03)
  it('lo que pagan los siete más el área común es lo que facturó SEDAPAL', () => {
    expect(Math.abs(c.sumaAgua + c.montoComun - c.facturaAgua)).toBeLessThan(0.03)
  })
})

describe('01 §10 · suma de flats', () => {
  // assert(DPTOS.reduce((s,d)=>s+d.flat,0) === 100)
  it('los siete flats suman exactamente 100', () => {
    expect(DPTOS.reduce((s, d) => s + d.flat, 0)).toBe(100)
  })
})

describe('01 §10 · lavado desactivado', () => {
  const c0 = calcularMesSemilla('2026-06', { lavadoM3: 0 })

  // assert(c0.lavado === 0)
  it('no se reasigna nada', () => {
    expect(c0.lavado).toBe(0)
  })

  // assert(c0.comunReal === c0.brutoComun)
  it('todo el bruto va al área común', () => {
    expect(c0.comunReal).toBe(c0.brutoComun)
  })

  // assert(Math.abs(c0.totalMes - c.totalMes) < 0.001)
  it('el total del mes NO cambia', () => {
    expect(Math.abs(c0.totalMes - c.totalMes)).toBeLessThan(0.001)
  })

  // assert(c0.cuotas['401'].total < c.cuotas['401'].total)
  it('el 401 paga menos', () => {
    expect(c0.cuotas['401'].total).toBeLessThan(c.cuotas['401'].total)
  })
})

describe('01 §10 · lavado mayor que el área común disponible', () => {
  // assert(cBig.lavado === 0)
  it('no se aplica', () => {
    expect(calcularMesSemilla('2026-06', { lavadoM3: 999 }).lavado).toBe(0)
  })
})

describe('01 §10 · reparto ajustado', () => {
  const cAdj = calcularMesSemilla('2026-06', { recibo: { aguaM3: 10 } })

  // assert(cAdj.ajustado === true)
  it('se activa', () => {
    expect(cAdj.ajustado).toBe(true)
  })

  // assert(cAdj.factor < 1)
  it('el factor es menor que 1', () => {
    expect(cAdj.factor).toBeLessThan(1)
  })

  // assert(cAdj.montoComun === 0)
  it('no hay área común que repartir', () => {
    expect(cAdj.montoComun).toBe(0)
  })

  // assert(cAdj.lavado === 0)
  it('el lavado no se aplica', () => {
    expect(cAdj.lavado).toBe(0)
  })

  // assert(cAdj.cuadraAgua === true)
  it('sigue cuadrando', () => {
    expect(cAdj.cuadraAgua).toBe(true)
  })
})

describe('01 §10 · mes con descuento de SEDAPAL', () => {
  // assert(cMay.facturaAgua === 325.00 - 17.33)
  it('mayo 2026 descuenta 17.33', () => {
    expect(calcularMesSemilla('2026-05').facturaAgua).toBe(325.0 - 17.33)
  })
})

describe('01 §10 · el pozo a tierra sin cifra', () => {
  // assert(calcularMes('2026-06').gastos.find(g => g.concepto === 'Pozo a tierra').monto === null)
  it('no rompe el total y sigue en null', () => {
    const pozo = calcularMesSemilla('2026-06').gastos.find((g) => g.concepto === 'Pozo a tierra')
    expect(pozo).toBeDefined()
    expect(pozo!.monto).toBeNull()
  })
})

describe('01 §10 · crédito: sale del saldo, no de los demás', () => {
  const cCred = calcularMesSemilla('2026-06', {
    extras: [{ tipo: 'credito', dpto: '301', monto: 50 }],
  })

  // assert(cCred.totalMes === c.totalMes)
  it('el gasto del edificio no cambia', () => {
    expect(cCred.totalMes).toBe(c.totalMes)
  })

  // assert(cCred.cuotas['301'].total === c.cuotas['301'].total - 50)
  it('el 301 paga 50 menos', () => {
    expect(cCred.cuotas['301'].total).toBe(c.cuotas['301'].total - 50)
  })

  // assert(cCred.cuotas['101'].total === c.cuotas['101'].total)
  it('nadie más lo paga', () => {
    expect(cCred.cuotas['101'].total).toBe(c.cuotas['101'].total)
  })

  // assert(cCred.cuadraMes === true)
  it('el mes sigue cuadrando', () => {
    expect(cCred.cuadraMes).toBe(true)
  })
})

describe('01 §10 · gasto extraordinario: sí lo pagan todos', () => {
  const cGas = calcularMesSemilla('2026-06', {
    extras: [{ tipo: 'gasto', concepto: 'Portón', monto: 700 }],
  })

  // assert(cGas.totalMes === c.totalMes + 700)
  it('sube el total del mes en 700', () => {
    expect(cGas.totalMes).toBe(c.totalMes + 700)
  })

  // assert(cGas.cuotas['101'].total > c.cuotas['101'].total)
  it('sube la cuota del 101', () => {
    expect(cGas.cuotas['101'].total).toBeGreaterThan(c.cuotas['101'].total)
  })
})
