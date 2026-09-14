/**
 * `pantallaPara` y `suenaAPreguntaDePantalla`, el mismo patrón de dos señales
 * que `procedimientoPara`/`suenaAComo`, y por la misma razón: sin el gate de
 * «suena a pregunta sobre la app», mencionar el nombre de una pantalla de
 * pasada —«mi departamento debe más que el mes pasado»— dispararía la
 * explicación de la pantalla en vez de la pregunta real.
 */

import { describe, expect, it } from 'vitest'
import { pantallaPara, suenaAPreguntaDePantalla } from '../pantallas'

describe('pantallaPara encuentra la pantalla por el nombre', () => {
  it.each([
    ['qué hay en mi departamento', 'mi-departamento'],
    ['qué es el historial', 'historial'],
    ['para qué sirve avisos', 'avisos'],
    ['no entiendo la pantalla de inicio', 'inicio'],
    ['qué muestra el mes', 'el-mes'],
  ])('«%s» → %s', (frase, clave) => {
    expect(pantallaPara(frase)?.clave).toBe(clave)
  })

  it('sin ninguna pantalla mencionada, no encuentra nada', () => {
    expect(pantallaPara('cuánto pago este mes')).toBeNull()
  })
})

describe('suenaAPreguntaDePantalla no se dispara por solo mencionar el nombre', () => {
  it('«mi departamento debe más que el mes pasado» no suena a pregunta de pantalla', () => {
    expect(suenaAPreguntaDePantalla('mi departamento debe más que el mes pasado')).toBe(false)
  })

  it('«qué hay en mi departamento» sí suena a pregunta de pantalla', () => {
    expect(suenaAPreguntaDePantalla('qué hay en mi departamento')).toBe(true)
  })
})
