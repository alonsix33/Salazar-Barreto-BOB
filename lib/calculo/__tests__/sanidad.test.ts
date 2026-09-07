/**
 * El tercer cuadre, probado **en dirección de fallo**.
 *
 * La batería llama a `revisarResultado` sobre meses buenos y comprueba que no
 * encuentra nada. Eso deja sin probar lo contrario: que cuando hay una cifra
 * imposible, la encuentre. La auditoría de los chequeos lo señaló —tres
 * cláusulas se podían neutralizar con la suite en verde— y estos tests lo
 * cierran: cada uno construye un resultado con un defecto concreto y exige que
 * salga en los motivos. Son la prueba negativa del cuadre de sanidad.
 */

import { describe, expect, it } from 'vitest'
import { revisarResultado } from '../sanidad'
import { DPTOS } from '../constantes'
import type { CuotaDpto, PorDpto } from '../tipos'

const cuota = (over: Partial<CuotaDpto> = {}): CuotaDpto => ({
  mantenimiento: 100, agua: 50, credito: 0, total: 150,
  m3: 10, m3medidos: 10, lavado: 0, lecturaAnterior: 0, lecturaActual: 10, ...over,
})

/** Un resultado sano, del que cada test estropea una sola cosa. */
function sano() {
  const cuotas = Object.fromEntries(DPTOS.map((d) => [d.id, cuota()])) as PorDpto<CuotaDpto>
  const consumos = Object.fromEntries(DPTOS.map((d) => [d.id, 10])) as PorDpto<number>
  return {
    consumos,
    cuotas,
    precioM3: 5,
    facturaAgua: 350,
    comunReal: 2,
    montoComun: 10,
    factor: 1,
    // `revisarResultado` exige que totalMes sea la suma de sus líneas; el fixture
    // parte de esa coherencia y cada test rompe una sola cosa.
    totalMes: 350,
    gastos: [{ concepto: 'Agua', monto: 350 }],
    rec: { aguaM3: 72, aguaMonto: 350, luz: 100, descuento: null as number | null },
  }
}

describe('revisarResultado encuentra lo que tiene que encontrar', () => {
  it('el mes sano no tiene motivos', () => {
    expect(revisarResultado(sano()).cuadra).toBe(true)
  })

  it('atrapa una factura que no cuadra con el recibo crudo (`sanidad.ts:165`)', () => {
    // El defecto real: se ignora el descuento, así que facturaAgua no coincide
    // con aguaMonto − descuento. Es lo que dejaba a los siete pagando de más.
    const r = { ...sano(), rec: { aguaM3: 72, aguaMonto: 350, luz: 100, descuento: 55 as number | null } }
    const revision = revisarResultado(r)
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/factura de agua no cuadra con el recibo/i)
  })

  it('atrapa un factor de ajuste mayor que 1 (`sanidad.ts:215`)', () => {
    const revision = revisarResultado({ ...sano(), factor: 1.2 })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/ajuste del reparto es imposible/i)
  })

  it('atrapa un total que no es la suma de sus líneas (`sanidad.ts:227`)', () => {
    const revision = revisarResultado({
      ...sano(),
      gastos: [{ concepto: 'Agua', monto: 350 }, { concepto: 'Fantasma', monto: 999 }],
      // totalMes se queda como estaba: no incluye los 999 de la línea fantasma.
    })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/total del mes no coincide/i)
  })

  it('atrapa un consumo negativo', () => {
    const consumos = { ...sano().consumos, [DPTOS[0]!.id]: -1 }
    const revision = revisarResultado({ ...sano(), consumos })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/menos que el mes pasado/i)
  })

  it('atrapa un área común negativa', () => {
    const revision = revisarResultado({ ...sano(), comunReal: -3 })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/área común sale negativa/i)
  })

  it('atrapa una cuota total negativa (el crédito se comió el mes)', () => {
    const cuotas = { ...sano().cuotas, [DPTOS[0]!.id]: cuota({ credito: 200, total: -50 }) }
    const revision = revisarResultado({ ...sano(), cuotas })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/crédito del .* es mayor que su cuota/i)
  })

  it('atrapa un NaN en una cuota', () => {
    const cuotas = { ...sano().cuotas, [DPTOS[0]!.id]: cuota({ total: NaN }) }
    const revision = revisarResultado({ ...sano(), cuotas })
    expect(revision.cuadra).toBe(false)
  })

  it('atrapa un precio del m³ negativo', () => {
    const revision = revisarResultado({ ...sano(), precioM3: -1 })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toMatch(/precio del m³/i)
  })
})
