/**
 * El adaptador de DeepSeek. Fase 8 §8.1.
 *
 * La API de DeepSeek es compatible con la de OpenAI, así que esto es un
 * `fetch` a `/chat/completions` con herramientas. **No hay SDK**: una
 * dependencia más para tres campos de JSON no se paga sola, y el adaptador
 * entero cabe en una pantalla.
 *
 * Lo que este fichero **no** hace: decidir si la respuesta se publica. De eso
 * se encarga `index.ts`, que aplica las guardas. Aquí solo se habla con el
 * modelo y se devuelve lo que dijo, tal cual, junto con las herramientas que
 * llamó por el camino.
 *
 * El tiempo de espera es **de la conversación entera**, no de cada petición: el
 * modelo puede dar tres vueltas de herramientas, y tres vueltas de 7 segundos
 * son 21 con el vecino mirando una pantalla quieta. Fase 8 §8.4.5 marca 8
 * segundos y son 8 en total.
 */

import { HERRAMIENTAS, herramienta } from './herramientas'
import { promptDelSistema } from './prompt'
import type { Contexto, Llamada } from './tipos'

/** Fase 8 §8.4.5. Pasado esto se cae al determinista. */
export const PLAZO_MS = 8_000

/** Cuántas veces se le deja pedir herramientas antes de exigirle que redacte. */
const MAX_VUELTAS = 4

const URL_BASE = process.env.DEEPSEEK_URL ?? 'https://api.deepseek.com'

/**
 * El modelo. `deepseek-chat` apunta siempre al modelo de chat vigente, que es
 * lo que se quiere para no quedarse anclado a una versión; `DEEPSEEK_MODELO`
 * está para fijarlo cuando haga falta reproducir una respuesta.
 */
const MODELO = process.env.DEEPSEEK_MODELO ?? 'deepseek-chat'

interface MensajeChat {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

export class SinClave extends Error {}
export class PlazoAgotado extends Error {}

/** `true` si hay clave. Sin clave no se intenta siquiera. */
export function hayClave(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}

/**
 * Le pregunta al modelo y devuelve lo que redactó, con sus llamadas.
 *
 * @throws {SinClave} si falta `DEEPSEEK_API_KEY`.
 * @throws {PlazoAgotado} si la conversación pasa de {@link PLAZO_MS}.
 */
export async function preguntarADeepseek(
  texto: string,
  contexto: Contexto,
): Promise<{ texto: string; llamadas: Llamada[] }> {
  const clave = process.env.DEEPSEEK_API_KEY
  if (!clave) throw new SinClave('Falta DEEPSEEK_API_KEY.')

  const limite = Date.now() + PLAZO_MS
  const llamadas: Llamada[] = []
  const mensajes: MensajeChat[] = [
    { role: 'system', content: promptDelSistema(contexto) },
    { role: 'user', content: texto },
  ]

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await pedir(mensajes, clave, limite, vuelta === MAX_VUELTAS - 1)
    const pedidas = respuesta.tool_calls ?? []
    if (pedidas.length === 0) {
      return { texto: (respuesta.content ?? '').trim(), llamadas }
    }
    mensajes.push({ role: 'assistant', content: respuesta.content ?? null, tool_calls: pedidas })
    for (const p of pedidas) {
      const resultado = await ejecutar(p.function.name, p.function.arguments, contexto, llamadas)
      mensajes.push({ role: 'tool', tool_call_id: p.id, content: JSON.stringify(resultado) })
    }
  }

  // Agotó las vueltas pidiendo herramientas y nunca redactó. Se trata como una
  // respuesta vacía: `index.ts` cae al determinista.
  return { texto: '', llamadas }
}

/**
 * Ejecuta una herramienta y deja constancia.
 *
 * Una herramienta que no existe **no revienta la conversación**: se le devuelve
 * al modelo un error legible para que rectifique. Que el modelo se invente un
 * nombre de función es esperable; que eso tumbe la respuesta del vecino, no.
 */
async function ejecutar(
  nombre: string,
  argumentosCrudos: string,
  contexto: Contexto,
  llamadas: Llamada[],
): Promise<unknown> {
  const h = herramienta(nombre)
  let argumentos: Record<string, unknown> = {}
  try {
    // Los argumentos los serializa el modelo; `JSON.parse` da `any`, y se tratan
    // como diccionario. Cada herramienta valida lo suyo con Zod al ejecutarse.
    argumentos = argumentosCrudos ? (JSON.parse(argumentosCrudos) as Record<string, unknown>) : {}
  } catch {
    argumentos = {}
  }
  if (!h) return { error: `No existe la herramienta ${nombre}.` }
  const t = Date.now()
  try {
    const resultado = await h.ejecutar(argumentos, contexto)
    llamadas.push({ herramienta: nombre, argumentos, resultado, ms: Date.now() - t })
    return resultado
  } catch (e) {
    const error = { error: e instanceof Error ? e.message : String(e) }
    llamadas.push({ herramienta: nombre, argumentos, resultado: error, ms: Date.now() - t })
    return error
  }
}

/** Una vuelta contra la API, con lo que quede del plazo. */
async function pedir(
  mensajes: MensajeChat[],
  clave: string,
  limite: number,
  ultima: boolean,
): Promise<MensajeChat> {
  const queda = limite - Date.now()
  if (queda <= 0) throw new PlazoAgotado('DeepSeek tardó más de lo que se le da.')

  const corte = new AbortController()
  const alarma = setTimeout(() => corte.abort(), queda)
  try {
    const r = await fetch(`${URL_BASE}/chat/completions`, {
      method: 'POST',
      signal: corte.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${clave}` },
      body: JSON.stringify({
        model: MODELO,
        messages: mensajes,
        // En la última vuelta se le quitan las herramientas: o redacta con lo
        // que ya tiene, o no hay respuesta.
        tools: ultima ? undefined : HERRAMIENTAS.map(comoFuncion),
        temperature: 0.2,
        max_tokens: 300,
      }),
    })
    if (!r.ok) throw new Error(`DeepSeek respondió ${r.status}.`)
    const cuerpo = (await r.json()) as { choices?: { message?: MensajeChat }[] }
    const mensaje = cuerpo.choices?.[0]?.message
    if (!mensaje) throw new Error('DeepSeek devolvió una respuesta sin mensaje.')
    return mensaje
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new PlazoAgotado('DeepSeek tardó más de lo que se le da.')
    }
    throw e
  } finally {
    clearTimeout(alarma)
  }
}

function comoFuncion(h: (typeof HERRAMIENTAS)[number]) {
  return {
    type: 'function' as const,
    function: { name: h.nombre, description: h.descripcion, parameters: h.parametros },
  }
}
