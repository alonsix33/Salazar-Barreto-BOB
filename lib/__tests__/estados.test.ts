/**
 * Cuándo un departamento figura como que le falta pagar.
 *
 * Lo que se protege aquí es un rótulo, no una cifra: **«Sin registrar» al lado
 * de una cuota en cero es mentira**, y la mentira señala justo al departamento
 * que no debe nada. Pasó de verdad al condonarle a 501 junio y julio de 2026:
 * su cuota quedó en S/ 0.00, no hay pago que registrar, y la píldora lo ponía
 * en «Sin aviso todavía» junto a un cero.
 */

import { describe, expect, it } from 'vitest'
import { estadoCuota, nadaPendiente, sumaAlSaldo } from '../estados'
import { COPYS } from '../copys'

const confirmado = { estado: 'confirmado' as const }
const aviso = { estado: 'aviso' as const }

describe('estadoCuota · con pago registrado manda el pago', () => {
  it('confirmado es al día, cualquiera sea la cuota', () => {
    for (const cuota of [0, 0.01, 500, -20, undefined]) {
      expect(estadoCuota(confirmado, cuota)).toBe('al-dia')
    }
  })

  it('un aviso queda en verificación aunque la cuota sea cero', () => {
    // Pasa: alguien deposita un mes que ya tenía cubierto con su crédito.
    expect(estadoCuota(aviso, 0)).toBe('en-verificacion')
  })
})

describe('estadoCuota · sin pago, el cero decide', () => {
  it('cuota en cero es «nada que pagar», no «sin registrar»', () => {
    expect(estadoCuota(null, 0)).toBe('sin-cobro')
  })

  it('una cuota negativa —le sobra crédito— tampoco es algo que falte', () => {
    expect(estadoCuota(null, -35.4)).toBe('sin-cobro')
  })

  it('un céntimo ya es algo que pagar', () => {
    expect(estadoCuota(null, 0.01)).toBe('sin-registrar')
  })

  it('medio céntimo redondea a cero, y cero no se cobra', () => {
    // El motor redondea a dos decimales antes de mostrar: si en pantalla dice
    // S/ 0.00, la píldora no puede decir que falta.
    expect(estadoCuota(null, 0.004)).toBe('sin-cobro')
    expect(estadoCuota(null, 0.005)).toBe('sin-registrar')
  })

  it('sin cuota conocida se mantiene el comportamiento de antes', () => {
    expect(estadoCuota(null, undefined)).toBe('sin-registrar')
    expect(estadoCuota(undefined)).toBe('sin-registrar')
  })
})

describe('nadaPendiente · lo que cuenta el «N de 7 al día»', () => {
  it('cuenta al que pagó y al que no tenía qué pagar', () => {
    expect(nadaPendiente(confirmado, 500)).toBe(true)
    expect(nadaPendiente(null, 0)).toBe(true)
  })

  it('no cuenta al que debe ni al que solo avisó', () => {
    expect(nadaPendiente(null, 500)).toBe(false)
    expect(nadaPendiente(aviso, 500)).toBe(false)
  })
})

describe('los cuatro estados tienen texto y no se repiten', () => {
  const todos = ['al-dia', 'sin-cobro', 'sin-registrar', 'en-verificacion'] as const

  it('cada uno tiene su rótulo', () => {
    for (const e of todos) expect(COPYS.estados[e]).toBeTruthy()
  })

  it('ningún rótulo se repite: dos estados con el mismo texto no se distinguen', () => {
    expect(new Set(todos.map((e) => COPYS.estados[e])).size).toBe(todos.length)
  })

  it('ninguno acusa a nadie · `01` §7', () => {
    for (const e of todos) {
      expect(COPYS.estados[e].toLowerCase()).not.toMatch(/moroso|deudor|vencid|debe|atras/)
    }
  })
})

describe('sumaAlSaldo no cambió', () => {
  it('solo los confirmados mueven la cuenta', () => {
    expect(sumaAlSaldo(confirmado)).toBe(true)
    expect(sumaAlSaldo(aviso)).toBe(false)
    expect(sumaAlSaldo(null)).toBe(false)
  })
})
