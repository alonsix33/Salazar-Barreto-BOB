/**
 * `finish_reason: 'length'`, la respuesta cortada a mitad de frase.
 *
 * Encontrado probando contra producción, no inventado: «qué hay en mi
 * departamento» devolvió `"Junio en el 401 sale S/ 364"`, sin los centavos,
 * con un 200 y un JSON válido. `pedir` nunca miraba `finish_reason`, así que
 * `max_tokens: 300` podía cortar al modelo a mitad de una cifra o de una
 * frase y esa respuesta se publicaba igual que una completa.
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
