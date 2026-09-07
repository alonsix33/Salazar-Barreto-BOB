/**
 * Las dos guardas que se pueden probar sin base de datos: la de longitud y —la
 * que importa— **la de números inventados**. Fase 8, verificador 2 y 3.
 *
 * Estos tests no comprueban que la guarda "existe": comprueban que **atrapa**.
 * Cada bloque tiene su prueba negativa al lado, con la cifra falsa metida a
 * propósito, porque un chequeo que nunca se vio fallar es una decoración.
 */

import { describe, expect, it } from 'vitest'
import { aDosFrases, numerosInventados, piezasPermitidas } from '../guardas'
import type { Llamada } from '../tipos'

/** Lo que devolvería `cuotaDe` para el 401 en junio. Cifras del mockup. */
const LLAMADA_CUOTA: Llamada = {
  herramienta: 'cuotaDe',
  argumentos: { mes: '2026-06', dpto: '401' },
  resultado: {
    mes: '2026-06',
    nombreMes: 'junio',
    dpto: '401',
    total: 343.48,
    mantenimiento: 268.9,
    agua: 74.58,
    m3: 8.42,
    lavado: 1.5,
  },
  ms: 3,
}

describe('guarda de longitud · Fase 8 §8.4.1', () => {
  it('recorta a dos frases una respuesta de diez párrafos', () => {
    const diezParrafos = Array.from(
      { length: 10 },
      (_, i) => `Este es el párrafo número ${i} y dice muchas cosas. Y sigue diciéndolas aquí.`,
    ).join('\n\n')
    const recortado = aDosFrases(diezParrafos)
    expect(recortado.split(/(?<=[.!?…])\s+/)).toHaveLength(2)
    expect(recortado).toBe('Este es el párrafo número 0 y dice muchas cosas. Y sigue diciéndolas aquí.')
  })

  it('no parte una cifra por el punto decimal', () => {
    const texto = 'Tu cuota de junio es S/ 1,355.25. Se paga a la cuenta conjunta. Y algo más que sobra.'
    const recortado = aDosFrases(texto)
    expect(recortado).toContain('S/ 1,355.25')
    expect(recortado).toBe('Tu cuota de junio es S/ 1,355.25. Se paga a la cuenta conjunta.')
  })

  it('deja pasar intacta una respuesta que ya cabe en dos frases', () => {
    const texto = 'Tu cuota de junio es S/ 343.48. Sale de S/ 268.90 de mantenimiento y S/ 74.58 de agua.'
    expect(aDosFrases(texto)).toBe(texto)
  })

  /**
   * Prueba negativa de la propia prueba: si `aDosFrases` no hiciera nada, el
   * test de arriba tendría que ponerse rojo. Se comprueba comparando contra la
   * función identidad.
   */
  it('sin la guarda, la respuesta larga pasaría entera', () => {
    const sinGuarda = (t: string) => t
    const diez = Array.from({ length: 10 }, (_, i) => `Frase ${i}.`).join(' ')
    expect(sinGuarda(diez).split(/(?<=[.!?…])\s+/).length).toBeGreaterThan(2)
    expect(aDosFrases(diez).split(/(?<=[.!?…])\s+/)).toHaveLength(2)
  })
})

describe('guarda de números · Fase 8 §8.4.3', () => {
  it('deja pasar una respuesta cuyas cifras salen todas de la herramienta', () => {
    const buena = 'Tu cuota de junio es S/ 343.48: S/ 268.90 de mantenimiento y S/ 74.58 de agua.'
    expect(numerosInventados(buena, [LLAMADA_CUOTA])).toEqual([])
  })

  /** El caso del enunciado: una cifra que el modelo se sacó de la manga. */
  it('atrapa una cifra inventada', () => {
    const mala = 'Tu cuota de junio es S/ 343.48, y el mes pasado fue S/ 312.90.'
    expect(numerosInventados(mala, [LLAMADA_CUOTA])).toContain('312.9')
  })

  /**
   * El caso más peligroso de todos: el del banco. `05` §2 lo nombra con estas
   * palabras, así que se prueba con ellas.
   */
  it('atrapa un depósito inventado con fecha', () => {
    const mala = 'Vi un depósito de S/ 343.48 el 24 de julio.'
    // La cifra sí sale de la herramienta; el día 24 no sale de ningún sitio.
    expect(numerosInventados(mala, [LLAMADA_CUOTA])).toContain('24')
  })

  it('atrapa un mes que nadie consultó', () => {
    const mala = 'En 2025-11 tu cuota fue S/ 343.48.'
    expect(numerosInventados(mala, [LLAMADA_CUOTA])).toContain('2025-11')
  })

  it('sin ninguna llamada, cualquier cifra es inventada', () => {
    expect(numerosInventados('Tu cuota es S/ 343.48.', [])).toEqual(['343.48'])
  })

  it('acepta la cifra redondeada a dos decimales que escribe fmt()', () => {
    const llamada: Llamada = { ...LLAMADA_CUOTA, resultado: { total: 343.4823 } }
    expect(numerosInventados('Son S/ 343.48.', [llamada])).toEqual([])
  })

  it('acepta separador de miles', () => {
    const llamada: Llamada = { ...LLAMADA_CUOTA, resultado: { totalMes: 1355.25 } }
    expect(numerosInventados('El mes costó S/ 1,355.25.', [llamada])).toEqual([])
  })

  it('acepta contar los elementos que devolvió la herramienta', () => {
    const llamada: Llamada = {
      herramienta: 'estadoPagos',
      argumentos: {},
      resultado: { alDia: ['201', '202', '301'], sinRegistrar: [] },
      ms: 1,
    }
    // El 3 sale de contar la lista que devolvió la herramienta, no de la nada.
    expect(numerosInventados('Van 3 al día: el 201, el 202 y el 301.', [llamada])).toEqual([])
  })

  /**
   * **La clave de que la guarda sirva de algo.**
   *
   * Si se recorrieran también las claves del resultado, `m3` metería un `3` en
   * la lista de permitidos y `precioM3` otro: cualquier «3» inventado pasaría.
   * Este test fija que las claves no cuentan.
   */
  it('las claves del resultado no autorizan sus dígitos', () => {
    const llamada: Llamada = {
      herramienta: 'cuotaDe',
      argumentos: {},
      resultado: { m3: 8.42, precioM3: 5.11 },
      ms: 1,
    }
    const permitido = piezasPermitidas([llamada])
    expect(permitido.numeros.has('3')).toBe(false)
    expect(numerosInventados('Son 3 metros.', [llamada])).toEqual(['3'])
  })

  it('las cifras dentro de un texto devuelto por la herramienta sí valen', () => {
    const llamada: Llamada = {
      herramienta: 'explicaLavado',
      argumentos: {},
      resultado: { explicacion: 'son 1.50 m³ que salen del caño común y el área común queda en 0.30 m³' },
      ms: 1,
    }
    expect(numerosInventados('El lavado son 1.50 m³ y el área común queda en 0.30 m³.', [llamada])).toEqual([])
  })
})
