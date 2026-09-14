/**
 * El prompt del sistema, en lo que se puede probar sin llamar al modelo de
 * verdad: que las instrucciones nuevas están escritas, no que el modelo las
 * siga —eso solo se ve preguntándole de verdad, como se hizo antes de este
 * cambio—.
 *
 * Existe porque un vecino preguntó «¿el 202 pagó más que yo?» sin ser
 * administrador, la herramienta le negó el dato del 202
 * (`{"error":"sin-departamento"}`, ver `dptoDe` en `herramientas.ts`), y el
 * modelo, sin instrucción para ese caso, contestó una pregunta distinta —el
 * total del edificio entre meses— sin avisar que había cambiado de tema.
 */

import { describe, expect, it } from 'vitest'
import { promptDelSistema } from '../prompt'
import type { Contexto } from '../tipos'

const VECINO: Contexto = { dpto: '401', mes: '2026-06', esAdmin: false }

describe('promptDelSistema · instrucciones que se agregaron a propósito', () => {
  it('dice qué hacer con el error de "sin-departamento"', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt).toContain('sin-departamento')
    // No solo que lo mencione: que le diga que avise en vez de cambiar de tema.
    expect(prompt.toLowerCase()).toContain('sin decir que')
  })

  it('dice que puede sumar varios meses o conceptos, no solo restar de a dos', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('sumar varios meses')
  })
})
