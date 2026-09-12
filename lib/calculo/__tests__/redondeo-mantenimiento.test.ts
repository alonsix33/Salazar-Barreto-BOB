/**
 * La forma exacta en que se redondea el mantenimiento.
 *
 * `01` §9 fija que el mantenimiento de cada departamento se calcula como
 * `Math.round(baseMant * flat) / 100`, y no como `round2(baseMant * flat / 100)`.
 * Las dos expresiones son **algebraicamente la misma**, y por eso la segunda
 * parece una simplificación inocente. No lo es: al dividir entre cien y volver
 * a multiplicar por cien se pasa por un número que el punto flotante no
 * representa exacto, y de vez en cuando cae al otro lado del redondeo.
 *
 * Medido, barriendo bases de S/ 500 a S/ 12 000 al céntimo con los siete flats:
 * **difieren en 49 de 8 050 007 combinaciones**, siempre por un céntimo. Uno de
 * cada ciento sesenta y cuatro mil, que es justo la frecuencia con la que nadie
 * lo encuentra a mano y aparece un día en la cuota de alguien.
 *
 * Este test existe porque la prueba negativa —que inyecta ese cambio a
 * propósito— reportaba «NO SE DETECTA»: la suite entera pasaba con la forma
 * mala puesta. Un defecto sin su test vuelve.
 */

import { describe, expect, it } from 'vitest'
import { calcularMes } from '../calcularMes'
import { DPTOS } from '../constantes'
import type { EntradasMes } from '../tipos'

/** Siete lecturas cualesquiera, con consumo, para que el mes sea válido. */
const ANTERIORES = { '101': 100, '201': 100, '202': 100, '301': 100, '401': 100, '501': 100, '502': 100 }
const ACTUALES = { '101': 105, '201': 106, '202': 107, '301': 108, '401': 109, '501': 110, '502': 111 }

/**
 * Un mes construido para que `baseMant` caiga en 1 312.50, que es uno de los
 * valores donde las dos formas se separan. El gasto puntual de S/ 92.50 es lo
 * que lo empuja ahí; no tiene nada de especial salvo eso.
 */
const MES: EntradasMes = {
  mesId: '2026-06',
  recibo: { aguaM3: 60, aguaMonto: 300, luz: 200, descuento: null },
  lecturas: ACTUALES as EntradasMes['lecturas'],
  lecturasAnteriores: ANTERIORES as EntradasMes['lecturasAnteriores'],
  fijos: [{ concepto: 'Guardianía', monto: 1000 }],
  extras: [{ tipo: 'gasto', concepto: 'Uno puntual', monto: 92.5 }],
  lavadoM3: 0,
}

describe('el mantenimiento se redondea con la forma de `01` §9', () => {
  const r = calcularMes(MES)

  it('el mes de prueba sigue cayendo en el valor que discrimina', () => {
    // Si alguien cambia el motor y `baseMant` deja de ser 1 312.50, este test
    // pasaría a no probar nada. Mejor que dé rojo y se rehaga el caso.
    expect(r.valido, 'el mes de prueba dejó de ser válido').toBe(true)
    expect(r.baseMant, 'el caso ya no discrimina: busca otro baseMant').toBe(1312.5)
  })

  it('el 101 paga 153.83, no 153.82', () => {
    // `Math.round(1312.5 * 11.72) / 100` = 153.83
    // `round2(1312.5 * 11.72 / 100)`    = 153.82  ← la forma mala
    expect(r.cuotas['101'].mantenimiento).toBe(153.83)
  })

  it('los siete salen de la fórmula literal, no de una equivalente', () => {
    for (const d of DPTOS) {
      expect(r.cuotas[d.id].mantenimiento, `el ${d.id}`).toBe(
        Math.round(r.baseMant * d.flat) / 100,
      )
    }
  })
})
