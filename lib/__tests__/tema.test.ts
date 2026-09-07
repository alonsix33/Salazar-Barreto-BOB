/**
 * `lib/tema.ts` es la única excepción a "cero valores huérfanos". Este test es
 * lo que la convierte en una excepción segura: comprueba que cada valor de ahí
 * sale, letra por letra, del token correspondiente de `app/globals.css`.
 *
 * **Recorre el módulo entero, no una lista escrita a mano.** Antes había un
 * `it()` por constante, nombradas una a una: al añadir dos colores nuevos, el
 * test siguió en verde sin mirarlas. Ahora se comparan todas las que exporta el
 * módulo, y **se exige que cada una tenga su token declarado en
 * `ORIGEN_TOKENS`**: una constante nueva sin origen pone el test en rojo, que es
 * justo lo que tiene que pasar.
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as tema from '../tema'

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../../app/globals.css'), 'utf8')

function valorDeToken(token: string): string | null {
  const m = css.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
  return m ? m[1]!.trim() : null
}

/** Las constantes de color que exporta el módulo, sin el mapa de orígenes. */
const CONSTANTES = Object.entries(tema).filter(
  ([nombre, valor]) => nombre !== 'ORIGEN_TOKENS' && typeof valor === 'string',
) as [string, string][]

describe('lib/tema.ts no se desincroniza de los tokens', () => {
  it('hay constantes que comprobar (si no, este test no prueba nada)', () => {
    expect(CONSTANTES.length).toBeGreaterThanOrEqual(4)
  })

  it('cada constante declara de qué token sale', () => {
    for (const [nombre] of CONSTANTES) {
      expect(
        Object.keys(tema.ORIGEN_TOKENS),
        `${nombre} no dice de qué token sale: añádelo a ORIGEN_TOKENS`,
      ).toContain(nombre)
    }
  })

  it('el token de cada constante existe en globals.css', () => {
    for (const token of Object.values(tema.ORIGEN_TOKENS)) {
      expect(valorDeToken(token), `falta ${token} en globals.css`).not.toBeNull()
    }
  })

  for (const [nombre, valor] of CONSTANTES) {
    const token = (tema.ORIGEN_TOKENS as Record<string, string>)[nombre]
    it(`${nombre} es ${token ?? '(sin origen declarado)'}`, () => {
      expect(token, `${nombre} necesita una entrada en ORIGEN_TOKENS`).toBeTruthy()
      expect(valor.toLowerCase()).toBe(valorDeToken(token!)!.toLowerCase())
    })
  }
})
