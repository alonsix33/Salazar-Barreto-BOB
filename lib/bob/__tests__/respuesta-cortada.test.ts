/**
 * `finish_reason: 'length'`, la respuesta cortada a mitad de frase.
 *
 * Encontrado probando contra producción, no inventado: «qué hay en mi
 * departamento» devolvió `"Junio en el 401 sale S/ 364"`, sin los centavos,
 * con un 200 y un JSON válido. `pedir` nunca miraba `finish_reason`, así que
 * el tope de tokens podía cortar al modelo a mitad de una cifra o de una
 * frase y esa respuesta se publicaba igual que una completa.
 *
 * Esto sigue siendo necesario aunque el tope haya subido de 300 a 1000
 * (pedido del usuario, para que una vuelta con herramienta o una respuesta
 * más rica no choque contra el límite): un tope más alto corta menos
 * seguido, no deja de existir.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { preguntarADeepseek } from '../deepseek'
import type { Contexto } from '../tipos'

const original = { ...process.env }
const fetchDeVerdad = globalThis.fetch

const YO: Contexto = { dpto: '401', mes: '2026-06', esAdmin: false }

afterEach(() => {
  process.env = { ...original }
  globalThis.fetch = fetchDeVerdad
})

function respuestaCortada(texto: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: texto }, finish_reason: 'length' }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function respuestaCompleta(texto: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: texto }, finish_reason: 'stop' }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

describe('una respuesta cortada por max_tokens no se publica', () => {
  it('finish_reason "length" hace fallar la llamada, en vez de devolver el texto a medias', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-de-prueba'
    globalThis.fetch = (async () => respuestaCortada('Junio en el 401 sale S/ 364')) as typeof fetch

    await expect(preguntarADeepseek('qué hay en mi departamento', YO)).rejects.toThrow()
  })

  it('finish_reason "stop" (lo normal) sí se publica tal cual', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-de-prueba'
    globalThis.fetch = (async () => respuestaCompleta('Junio en el 401 es S/ 364.05.')) as typeof fetch

    const r = await preguntarADeepseek('qué hay en mi departamento', YO)
    expect(r.texto).toBe('Junio en el 401 es S/ 364.05.')
  })
})

/**
 * Pedido del usuario: 300 alcanzaba para una frase corta, pero no para una
 * vuelta que además razona qué herramienta llamar, ni para las respuestas
 * más ricas que ganó Bob esta sesión. Subirlo no es una invitación a
 * escribir más largo —«dos frases» sigue en el prompt y `aDosFrases` sigue
 * recortando— es margen para que esas vueltas no choquen contra el tope
 * por las puras.
 */
describe('el tope de tokens le da margen a una vuelta con herramienta', () => {
  it('la petición a DeepSeek pide 1000 tokens, no 300', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-de-prueba'
    let maxTokensPedido = 0
    globalThis.fetch = (async (_url: string | URL, opciones?: RequestInit) => {
      maxTokensPedido = (JSON.parse(String(opciones?.body)) as { max_tokens: number }).max_tokens
      return respuestaCompleta('Todo al día.')
    }) as typeof fetch

    await preguntarADeepseek('¿cuánto debo?', YO)

    expect(maxTokensPedido).toBe(1000)
  })
})
