/**
 * `pantallaPara` y `suenaAPreguntaDePantalla`, el mismo patrón de dos señales
 * que `procedimientoPara`/`suenaAComo`, y por la misma razón: sin el gate de
 * «suena a pregunta sobre la app», mencionar el nombre de una pantalla de
 * pasada —«mi departamento debe más que el mes pasado»— dispararía la
 * explicación de la pantalla en vez de la pregunta real.
 *
 * Pedido del usuario: nadie escribe «¿qué hay en Mi departamento?» tal cual.
 * Escriben «cómo pago», «de dónde sale mi cuota», sin la redacción prolija
 * de un formulario. Por eso las dos listas —`seDiceAsi` en `pantallas.ts` y
 * el regex de `suenaAPreguntaDePantalla`— se ampliaron a propósito, y esto
 * prueba justo esas frases reales, no solo las bien escritas.
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
    ['cómo pago', 'como-pagar'],
    ['cómo pago este mes', 'como-pagar'],
    ['de dónde sale mi cuota', 'como-se-calculo'],
    ['cómo se calcula mi cuota', 'como-se-calculo'],
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

  it.each(['cómo pago', 'de dónde sale mi cuota', 'cómo se calcula el agua', 'no entiendo esta app', 'cómo funciona esto'])(
    '«%s» también suena a pregunta de pantalla',
    (frase) => {
      expect(suenaAPreguntaDePantalla(frase)).toBe(true)
    },
  )
})
