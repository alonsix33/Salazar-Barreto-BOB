/**
 * La foto del edificio ↔ leer mes a mes.
 *
 * La optimización de la lentitud cambió **de dónde** salen los números de las
 * pantallas: antes cada mes se leía con sus seis consultas y se calculaba
 * aparte; ahora se leen las siete tablas de una vez y los meses se calculan en
 * memoria. El motor es el mismo, pero la lectura no, y ahí hay cuatro sitios
 * donde una foto puede mentir sin que nada se ponga rojo:
 *
 *  1. **La lectura anterior.** Un mes calcula su consumo contra el mes de
 *     antes, que puede no estar en la lista de meses con recibo.
 *  2. **Los gastos fijos vigentes.** Si el filtro por `vigenteDesde` o el orden
 *     cambian, cada mes se lleva el monto de otra época.
 *  3. **El lavado.** Con su herencia del mes anterior y su valor congelado al
 *     publicar. Es el que más veces se ha roto en este proyecto.
 *  4. **La conversión `Decimal → number`.** Pasa por `unstable_cache`, que
 *     serializa: un `Decimal` que se colara volvería convertido en otra cosa.
 *
 * Así que esto no comprueba «sale un número razonable»: comprueba que sale
 * **exactamente** el mismo que salía antes, campo por campo, mes a mes y
 * departamento a departamento. La prueba negativa de este test está en
 * `scripts/prueba-negativa-integracion.mjs`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import { calcularMes } from '@/lib/calculo/calcularMes'
import { almanaque, almanaqueFresco } from '@/lib/datos/almanaque'
import { entradasDeMes, pagosDe } from '@/lib/datos/mes'
import { mesAnterior } from '@/lib/calculo/mes'
import type { MesId } from '@/lib/calculo/tipos'
import { prisma, resembrar } from './entorno'

beforeAll(async () => {
  await resembrar()
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

/** Los meses a comparar, más el anterior al primero: ese no tiene recibo. */
async function mesesAComparar(): Promise<MesId[]> {
  const foto = await almanaque()
  const conRecibo = foto.mesesConRecibo
  const primero = conRecibo[0]
  return primero ? [mesAnterior(primero), ...conRecibo] : []
}

describe('la foto del edificio dice lo mismo que leer mes a mes', () => {
  it('las entradas de cada mes son idénticas a las que devuelve la base', async () => {
    const foto = await almanaque()
    const meses = await mesesAComparar()
    expect(meses.length).toBeGreaterThan(1)
    for (const mes of meses) {
      const deLaBase = await entradasDeMes(mes, prisma)
      expect({ mes, ...foto.entradasDe(mes) }).toEqual({ mes, ...deLaBase })
    }
  })

  it('cada cuota calculada desde la foto es la misma, al céntimo', async () => {
    const foto = await almanaque()
    for (const mes of await mesesAComparar()) {
      const deLaBase = calcularMes(await entradasDeMes(mes, prisma))
      const deLaFoto = foto.resultadoDe(mes)
      expect({ mes, r: deLaFoto }).toEqual({ mes, r: deLaBase })
      if (deLaBase.valido && deLaFoto.valido) {
        for (const d of DPTO_IDS) {
          expect(deLaFoto.cuotas[d].total).toBe(deLaBase.cuotas[d].total)
        }
      }
    }
  })

  it('los pagos de cada mes son los mismos', async () => {
    const foto = await almanaque()
    for (const mes of await mesesAComparar()) {
      expect({ mes, p: foto.pagosDe(mes) }).toEqual({ mes, p: await pagosDe(mes, prisma) })
    }
  })

  it('no se cuela ningún Decimal ni ningún Date en lo que se cachea', async () => {
    /**
     * `unstable_cache` serializa lo que guarda. Un `Decimal` volvería del otro
     * lado convertido en `{ s, e, d }` y la cuota saldría `NaN` —o peor, un
     * número parecido—. Se comprueba que lo crudo sobrevive a un ida y vuelta
     * por JSON sin cambiar en nada.
     */
    const foto = await almanaque()
    expect(JSON.parse(JSON.stringify(foto.crudos))).toEqual(foto.crudos)
  })

  it('la foto fresca dice lo mismo que la normal', async () => {
    const a = await almanaque()
    const b = await almanaqueFresco()
    expect(b.crudos).toEqual(a.crudos)
    expect(b.mesesPublicados).toEqual(a.mesesPublicados)
  })
})
