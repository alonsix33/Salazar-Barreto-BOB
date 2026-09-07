/**
 * Candado del flat: la base y el código dicen lo mismo.
 *
 * El motor reparte con la constante de `constantes.ts`; la columna
 * `departamento.flat` de la base no la lee nadie para calcular. Hoy coinciden,
 * pero son dos verdades sin candado: editar la columna en Railway no cambiaría
 * un céntimo y nadie se enteraría de que la base y el cálculo dejaron de decir lo
 * mismo. Este test las engancha: si difieren, se pone en rojo.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { DPTOS, dpto } from '@/lib/calculo/constantes'
import { aNumeroObligatorio } from '@/lib/datos/decimal'
import { prisma, resembrar } from './entorno'

describe('el flat de la base coincide con el del código', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('cada departamento tiene en la base el mismo flat que usa el motor', async () => {
    const filas = await prisma.departamento.findMany()
    expect(filas.length).toBe(DPTOS.length)
    for (const fila of filas) {
      const enCodigo = dpto(fila.id as (typeof DPTOS)[number]['id']).flat
      expect(aNumeroObligatorio(fila.flat)).toBe(enCodigo)
    }
  })

  it('los flats suman 100.00 exactos', async () => {
    const filas = await prisma.departamento.findMany()
    const suma = filas.reduce((s, f) => s + aNumeroObligatorio(f.flat), 0)
    expect(Math.round(suma * 100) / 100).toBe(100)
  })
})
