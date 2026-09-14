/**
 * El prompt del sistema, en lo que se puede probar sin llamar al modelo de
 * verdad: que las instrucciones nuevas están escritas, no que el modelo las
 * siga —eso solo se ve preguntándole de verdad, como se hizo antes y después
 * de este cambio, dos veces—.
 *
 * Existe porque un vecino preguntó «¿el 202 pagó más que yo?» sin ser
 * administrador. La primera versión de esta instrucción solo cubría el caso
 * en que el modelo llama a una herramienta y choca con
 * `{"error":"sin-departamento"}` (`dptoDe` en `herramientas.ts`). Probado
 * contra producción, el modelo casi nunca llegaba a llamar la herramienta:
 * como ya sabía por el contexto que no podía ver el dato del 202, saltaba
 * directo a contestar una pregunta distinta —el total del edificio entre
 * meses— sin avisar. La segunda versión cubrió también la decisión de
 * antemano, escrita como regla larga más abajo en el prompt. Vuelta a
 * probar contra producción, siguió sin bastar: cinco de seis veces el
 * modelo la ignoraba igual. La tercera repite la misma regla, corta, pegada
 * al párrafo de permiso —lo primero que el modelo lee sobre lo que puede y
 * no puede hacer— por si la cercanía pesa más que la insistencia. Sigue sin
 * poder probarse aquí si eso alcanza: eso se ve preguntándole de verdad.
 */

import { describe, expect, it } from 'vitest'
import { promptDelSistema } from '../prompt'
import type { Contexto } from '../tipos'

const VECINO: Contexto = { dpto: '401', mes: '2026-06', esAdmin: false }

describe('promptDelSistema · instrucciones que se agregaron a propósito', () => {
  it('dice qué hacer con el error de "sin-departamento"', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt).toContain('sin-departamento')
  })

  it('cubre también el caso en que decide de antemano, sin llamar a ninguna herramienta', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('lo sepas antes de llamar a una herramienta')
  })

  it('prohíbe sustituir en silencio la pregunta por otra que sí pueda resolver', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('sustituirla en silencio')
  })

  it('repite la regla corta, pegada al párrafo de permiso', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('dilo así de directo')
    // Un admin no tiene esta restricción, así que no debe llevar la frase.
    const admin = promptDelSistema({ ...VECINO, esAdmin: true })
    expect(admin.toLowerCase()).not.toContain('dilo así de directo')
  })

  it('dice que puede sumar varios meses o conceptos, no solo restar de a dos', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('sumar varios meses')
  })

  it('dice qué hacer con un "ayuda" o un "no sé qué hacer": adelantarse, no preguntar de vuelta', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt).toContain('AYUDA')
    expect(prompt.toLowerCase()).toContain('no preguntes "¿en qué te ayudo?"')
  })
})
