/**
 * La URL y el modelo de DeepSeek, con la variable de entorno puesta y vacía.
 *
 * Esto existe por un fallo real en producción: `DEEPSEEK_URL=""` y
 * `DEEPSEEK_MODELO=""` (copiadas tal cual de `.env.example` a Vercel) son
 * cadenas vacías, no `undefined`, y `??` solo cae al valor por defecto con
 * `undefined`. Con eso, cada pregunta a Bob intentaba `fetch('/chat/completions')`
 * —una URL relativa, que en el servidor no tiene página desde la que
 * resolverse— y caía al catálogo en silencio. El error real, visto en los
 * logs de Vercel: `Failed to parse URL from /chat/completions`. Ninguna
 * prueba lo veía porque las que simulan `fetch` reemplazan la función entera
 * y nunca llegan a la validación de URL que hace el `fetch` de verdad.
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

function respuestaSimulada() {
  return new Response(JSON.stringify({ choices: [{ message: { content: 'Todo al día.' } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('urlBase() y modelo(), con la variable puesta y vacía', () => {
  it('DEEPSEEK_URL="" no manda una URL relativa: usa la de verdad', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-de-prueba'
    process.env.DEEPSEEK_URL = ''
    let urlPedida = ''
    globalThis.fetch = (async (url: string | URL) => {
      urlPedida = String(url)
      return respuestaSimulada()
    }) as typeof fetch

    await preguntarADeepseek('¿cuánto debo?', YO)

    expect(urlPedida).toBe('https://api.deepseek.com/chat/completions')
  })

  it('DEEPSEEK_MODELO="" no manda un modelo vacío: usa el nombre vigente', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-de-prueba'
    process.env.DEEPSEEK_MODELO = ''
    let modeloPedido = ''
    globalThis.fetch = (async (_url: string | URL, opciones?: RequestInit) => {
      modeloPedido = (JSON.parse(String(opciones?.body)) as { model: string }).model
      return respuestaSimulada()
    }) as typeof fetch

    await preguntarADeepseek('¿cuánto debo?', YO)

    expect(modeloPedido).not.toBe('')
    expect(modeloPedido).toBe('deepseek-flash')
  })

  it('con DEEPSEEK_URL puesta de verdad, esa es la que se usa', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-de-prueba'
    process.env.DEEPSEEK_URL = 'https://un-simulador.example'
    let urlPedida = ''
    globalThis.fetch = (async (url: string | URL) => {
      urlPedida = String(url)
      return respuestaSimulada()
    }) as typeof fetch

    await preguntarADeepseek('¿cuánto debo?', YO)

    expect(urlPedida).toBe('https://un-simulador.example/chat/completions')
  })
})
