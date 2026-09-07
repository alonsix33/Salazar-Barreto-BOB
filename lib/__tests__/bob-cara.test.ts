/**
 * `lib/bob-cara.ts` está exento de la regla `hex` de `verificar-tokens`. Este
 * test es lo que convierte esa exención en algo seguro, y hace dos cosas:
 *
 *  1. **Los colores no se desincronizan de los tokens.** Cada constante de
 *     color de ahí tiene que salir, letra por letra, del token de
 *     `app/globals.css` que declara en `ORIGEN_TOKENS`. Se recorren todas las
 *     que exporta el módulo, no una lista escrita a mano: una constante nueva
 *     sin origen pone esto en rojo.
 *
 *  2. **La cara de Bob no se mueve.** La semilla y los rasgos fijados *son* su
 *     cara: cambiar cualquiera de los dos la convierte en otra. Aquí quedan
 *     clavados, así que un cambio accidental —o un «lo toqué para probar» que se
 *     quedó— sale en rojo en vez de llegar a la pantalla de los siete vecinos.
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as cara from '../bob-cara'

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../../app/globals.css'), 'utf8')

function valorDeToken(token: string): string | null {
  const m = css.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
  return m ? m[1]!.trim() : null
}

/**
 * Las constantes de color del módulo.
 *
 * Se filtran por «parece un hexadecimal» y no por «es una cadena», porque
 * `SEMILLA` también es una cadena y no es un color: con el filtro ingenuo, el
 * test le habría exigido un token a la semilla.
 */
const COLORES = Object.entries(cara).filter(
  ([, valor]) => typeof valor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(valor),
) as [string, string][]

describe('los colores de la cara de Bob salen de los tokens', () => {
  it('hay colores que comprobar (si no, este test no prueba nada)', () => {
    expect(COLORES.length).toBeGreaterThanOrEqual(2)
  })

  it('cada color declara de qué token sale', () => {
    for (const [nombre] of COLORES) {
      expect(
        Object.keys(cara.ORIGEN_TOKENS),
        `${nombre} no dice de qué token sale: añádelo a ORIGEN_TOKENS`,
      ).toContain(nombre)
    }
  })

  it('el token de cada color existe en globals.css', () => {
    for (const token of Object.values(cara.ORIGEN_TOKENS)) {
      expect(valorDeToken(token), `falta ${token} en globals.css`).not.toBeNull()
    }
  })

  for (const [nombre, valor] of COLORES) {
    const token = (cara.ORIGEN_TOKENS as Record<string, string>)[nombre]
    it(`${nombre} es ${token ?? '(sin origen declarado)'}`, () => {
      expect(token, `${nombre} necesita una entrada en ORIGEN_TOKENS`).toBeTruthy()
      expect(valor.toLowerCase()).toBe(valorDeToken(token!)!.toLowerCase())
    })
  }
})

describe('la construcción del blob de Bob no se mueve', () => {
  it('la semilla es la de Bob', () => {
    // La semilla decide todos los rasgos que NO se fijan abajo. Cambiarla mueve
    // la cara aunque los rasgos se queden igual.
    expect(cara.SEMILLA).toBe('elin')
  })

  it('los rasgos fijados son exactamente los de Bob', () => {
    expect(cara.RASGOS).toEqual({
      shape: 0.745,
      'body.ratio': 0.152,
      'eye.rx': 0.999,
      'eye.ratio': 0.723,
      hue: 0.176,
      'nub.r0': 0.74,
    })
  })

  it('no se le añaden ni se le quitan rasgos sin darse cuenta', () => {
    expect(Object.keys(cara.RASGOS)).toHaveLength(6)
  })
})
