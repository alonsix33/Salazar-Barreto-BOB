/**
 * El prompt del sistema, en lo que se puede probar sin llamar al modelo de
 * verdad: que las instrucciones nuevas están escritas, no que el modelo las
 * siga —eso solo se ve preguntándole de verdad, como se hizo antes y después
 * de este cambio—.
 *
 * Existe porque un vecino preguntó «¿el 202 pagó más que yo?» sin ser
 * administrador. La primera versión de esta instrucción solo cubría el caso
 * en que el modelo llama a una herramienta y choca con
 * `{"error":"sin-departamento"}` (`dptoDe` en `herramientas.ts`). Probado
 * contra producción después de desplegarla, el modelo casi nunca llegaba a
 * llamar la herramienta: como ya sabía por el contexto que no podía ver el
 * dato del 202, saltaba directo a contestar una pregunta distinta —el total
 * del edificio entre meses— sin avisar que había cambiado de tema. Hubo que
 * ampliar la instrucción para cubrir también la decisión tomada de
 * antemano, sin ninguna llamada de por medio.
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

  it('dice que puede sumar varios meses o conceptos, no solo restar de a dos', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('sumar varios meses')
  })
})
