/**
 * Las etiquetas cortas del eje muestran el año solo cuando cambia.
 *
 * Sin esto, una serie que cruza de 2025 a 2026 pinta dos «ENE» iguales y no se
 * sabe cuál es cuál. El año aparece en el primero y en cada salto, y no satura.
 */
import { describe, expect, it } from 'vitest'
import { cortosConAnio } from '../mes'
import type { MesId } from '../tipos'

describe('cortosConAnio', () => {
  it('un solo año: el año va solo en el primero', () => {
    const r = cortosConAnio(['2026-05', '2026-06', '2026-07'] as MesId[])
    expect(r).toEqual(["MAY '26", 'JUN', 'JUL'])
  })

  it('al cruzar de año, el enero siguiente lleva el año', () => {
    const r = cortosConAnio(['2025-11', '2025-12', '2026-01', '2026-02'] as MesId[])
    expect(r).toEqual(["NOV '25", 'DIC', "ENE '26", 'FEB'])
  })

  it('lista vacía no revienta', () => {
    expect(cortosConAnio([])).toEqual([])
  })
})
