/**
 * El reparto de un gasto puntual entre los que lo pagan.
 *
 * Lo que se comprueba aquí no es que las cifras «se vean bien»: es que **la
 * suma sea exactamente el monto**, al céntimo, en todos los casos. Si se pierde
 * o se inventa un céntimo, el mes deja de cuadrar y el paso 6 bloquea la
 * publicación —o peor, cuadra por tolerancia y alguien paga de más.
 */

import { describe, expect, it } from 'vitest'
import { repartir } from '../reparto'
import { DPTOS, DPTO_IDS } from '../constantes'
import type { DptoId } from '../tipos'

const suma = (r: Partial<Record<DptoId, number>>) =>
  Math.round(Object.values(r).reduce((s, v) => s + (v ?? 0), 0) * 100) / 100

describe('repartir · la suma es exacta', () => {
  /**
   * Barrido: todos estos montos, con todos los subconjuntos de tamaño 1 a 7,
   * en los dos modos. Un reparto que pierde céntimos casi nunca los pierde con
   * el número redondo que uno probaría a mano.
   */
  it('nunca pierde ni inventa un céntimo, en 2 000 combinaciones', () => {
    const montos = [0.01, 0.03, 1, 7, 39, 100, 182.9, 300, 1280.3, 999.99, 5000.55]
    let casos = 0
    for (const monto of montos) {
      for (let mascara = 1; mascara < 1 << DPTOS.length; mascara++) {
        const participantes = DPTOS.filter((_, i) => mascara & (1 << i)).map((d) => d.id)
        for (const modo of ['porcentaje', 'iguales'] as const) {
          const r = repartir(monto, participantes, modo)
          expect(suma(r), `${monto} entre ${participantes.join(',')} por ${modo}`).toBe(monto)
          casos++
        }
      }
    }
    expect(casos).toBeGreaterThan(2000)
  })

  it('sin participantes reparte entre los siete', () => {
    const r = repartir(700, undefined)
    expect(Object.keys(r).sort()).toEqual([...DPTO_IDS].sort())
    expect(suma(r)).toBe(700)
  })

  it('una lista vacía también significa los siete', () => {
    expect(Object.keys(repartir(700, []))).toHaveLength(7)
  })
})

describe('repartir · respeta la proporción', () => {
  it('el portón sin el 101: el 101 no aparece y los seis pagan por su flat', () => {
    const seis = DPTO_IDS.filter((d) => d !== '101')
    const r = repartir(300, seis)
    expect(r['101']).toBeUndefined()
    expect(suma(r)).toBe(300)
    // El 502 (20.23 %) paga casi el doble que el 201 (10.21 %), que es lo que
    // significa el flat. Con partes iguales pagarían lo mismo.
    expect(r['502']!).toBeGreaterThan(r['201']! * 1.9)
    // Y el nuevo 100 % es la suma de los seis: 88.28.
    const base = DPTOS.filter((d) => d.id !== '101').reduce((s, d) => s + d.flat, 0)
    expect(r['201']).toBeCloseTo((300 * 10.21) / base, 1)
  })

  it('en partes iguales todos pagan lo mismo', () => {
    const r = repartir(1280.3, undefined, 'iguales')
    expect(suma(r)).toBe(1280.3)
    expect(new Set(Object.values(r)).size).toBe(1)
    expect(r['101']).toBe(182.9)
  })

  it('a un solo departamento le toca todo', () => {
    expect(repartir(150, ['401'])).toEqual({ '401': 150 })
  })
})

describe('repartir · entradas imposibles no rompen nada', () => {
  for (const malo of [0, NaN, Infinity, -Infinity]) {
    it(`${malo} devuelve un reparto vacío en vez de cifras basura`, () => {
      expect(repartir(malo, undefined)).toEqual({})
    })
  }

  it('un departamento que no existe se ignora y no deja el reparto a medias', () => {
    // `as`: se fuerza un id inventado a propósito, que es lo que este test mide.
    const r = repartir(100, ['999' as DptoId, '301'])
    expect(r).toEqual({ '301': 100 })
  })

  it('un monto negativo se reparte negativo, y la suma sigue siendo exacta', () => {
    // Pasa de verdad: una corrección que baja un gasto ya cobrado.
    expect(suma(repartir(-300, DPTO_IDS.filter((d) => d !== '101')))).toBe(-300)
  })
})
