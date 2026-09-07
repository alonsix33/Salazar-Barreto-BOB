/**
 * Cómo habla Bob. `05-bob-agente.md` §3 y el criterio de redacción de la casa.
 *
 * **Este test mira el texto que sale, no el que está escrito en el código.** Es
 * la diferencia entre comprobar una plantilla y comprobar una respuesta: las
 * plantillas se rellenan con cifras de la base, y una frase puede leerse bien
 * vacía y mal llena. Aquí se generan las respuestas de verdad, contra la base
 * sembrada, y se revisan una por una.
 *
 * Los defectos que busca no son de opinión. Son las huellas concretas que
 * delatan un texto de máquina: la raya larga, la muletilla de chatbot, el
 * vocabulario de folleto, la disculpa, el hablar de sí mismo. Y las dos reglas
 * del producto que no se negocian: nada de lenguaje de cobranza, y ninguna
 * respuesta sin dato.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { preguntarABob } from '@/lib/bob'
import { COPYS } from '@/lib/copys'
import type { Contexto } from '@/lib/bob/tipos'
import { prisma, resembrar } from './entorno'

/**
 * Un barrido ancho, no las cuatro sugeridas.
 *
 * Con las cuatro de la hoja, el test comprueba las cuatro frases que ya se
 * leyeron a mano y nada más. Las respuestas malas viven en las ramas que nadie
 * mira: el mes sin cerrar, el vecino sin departamento, la orden de escritura,
 * la pregunta que no encaja en ninguna intención.
 */
const PREGUNTAS = [
  ...COPYS.bob.sugeridas,
  '¿Cuánto pago este mes?',
  '¿Por qué está tan cara el agua?',
  '¿Cómo van los pagos?',
  '¿En qué se gastó la plata?',
  '¿Cuánto hay en el fondo?',
  '¿Subió respecto al mes pasado?',
  '¿Qué pasó con el lavado del carro?',
  '¿Viste mi depósito?',
  '¿Llegó mi transferencia?',
  'Confirma mi pago',
  'Publica el mes',
  'Corrige la lectura del 401',
  '¿Cuál es la capital de Francia?',
  'hola',
]

/** Los tres contextos que cambian de rama: con dpto, sin dpto, y mes sin cerrar. */
const CONTEXTOS: { como: string; contexto: Contexto }[] = [
  { como: 'un vecino del 401 en un mes publicado', contexto: { dpto: '401', mes: '2026-06', esAdmin: false } },
  { como: 'alguien que aún no eligió departamento', contexto: { dpto: null, mes: '2026-06', esAdmin: false } },
  { como: 'un vecino mirando un mes sin cerrar', contexto: { dpto: '301', mes: '2026-07', esAdmin: false } },
  { como: 'quien administra', contexto: { dpto: '401', mes: '2026-06', esAdmin: true } },
]

/** Huella, y por qué es huella. El motivo sale en el mensaje cuando falla. */
const HUELLAS: [RegExp, string][] = [
  [/—/, 'raya larga: se reemplaza por coma, punto o paréntesis'],
  [/\b(lo siento|disculpa|perdona|lamentablemente)\b/i, 'disculpa: Bob dice qué sí puede, no pide perdón'],
  [/\b(como asistente|como IA|soy un asistente|no puedo ayudarte)\b/i, 'habla de sí mismo · `05` §3'],
  [/(espero que esto|avísame si|aquí te dejo|por supuesto|claro que sí|¿quieres que)/i, 'muletilla de chatbot'],
  [/\b(moroso|morosa|deudor|deudora|vencido|vencida|impago)\b/i, 'lenguaje de cobranza · el producto no lo tiene'],
  [/\b(crucial|fundamental|robusto|sólido|potenciar|fomentar|abordar|ámbito|panorama|ecosistema|hito|sinergia)\b/i,
    'vocabulario de folleto'],
  [/\b(en definitiva|cabe destacar|es importante señalar|no obstante|asimismo|adicionalmente)\b/i,
    'conector calcado: «también», «pero», o nada'],
  [/(en un mundo|en el contexto actual|hoy más que nunca|a medida que avanza|en la era de)/i,
    'arranque abstracto: se borra la primera oración y el texto mejora'],
  [/¿(la clave|el detalle|lo interesante|la razón)\?/i, 'pregunta gancho'],
  [/\b(marca un hito|punto de inflexión|se consolida como|propuesta de valor|apuesta decidida)\b/i,
    'importancia inflada'],
  [/[✨🚀💡🎯🔥]/u, 'emoji decorativo: fuera de la app'],
]

/** Una respuesta sin cifra solo vale si dice, con todas las letras, que no hay dato. */
const SIN_DATO =
  /(no tengo dato|todavía no|no hay|aún no|elígelo|lo cambia quien administra|no los veo yo)/i

beforeAll(async () => {
  await resembrar()
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

describe('ninguna respuesta de Bob suena a máquina', () => {
  for (const { como, contexto } of CONTEXTOS) {
    it(`para ${como}`, async () => {
      const fallos: string[] = []
      for (const pregunta of PREGUNTAS) {
        const r = await preguntarABob(pregunta, contexto)
        for (const [patron, porQue] of HUELLAS) {
          const m = r.texto.match(patron)
          if (m) fallos.push(`«${pregunta}» → ${porQue} · "${m[0]}"\n     ${r.texto}`)
        }
      }
      expect(fallos.join('\n  ')).toBe('')
    })
  }
})

describe('toda respuesta cabe en dos frases y trae dato', () => {
  for (const { como, contexto } of CONTEXTOS) {
    it(`para ${como}`, async () => {
      const largas: string[] = []
      const vacias: string[] = []
      for (const pregunta of PREGUNTAS) {
        const r = await preguntarABob(pregunta, contexto)
        if (r.texto.split(/(?<=[.!?…])\s+/).length > 2) largas.push(`«${pregunta}» → ${r.texto}`)
        // `05` §3: siempre con el dato. Si no hay cifra, tiene que decir por qué.
        if (!/\d/.test(r.texto) && !SIN_DATO.test(r.texto)) vacias.push(`«${pregunta}» → ${r.texto}`)
      }
      expect(largas.join('\n  '), 'pasan de dos frases').toBe('')
      expect(vacias.join('\n  '), 'sin cifra y sin decir que no hay dato').toBe('')
    })
  }
})

describe('ninguna respuesta se queda a medias', () => {
  it('no termina en coma, en «y», ni en una frase cortada', async () => {
    const malas: string[] = []
    for (const { contexto } of CONTEXTOS) {
      for (const pregunta of PREGUNTAS) {
        const r = await preguntarABob(pregunta, contexto)
        if (!/[.!?…]$/.test(r.texto.trim())) malas.push(`«${pregunta}» → ${r.texto}`)
        if (/\b(y|de|con|que|para|entre)\s*[.]$/i.test(r.texto.trim())) malas.push(`«${pregunta}» → ${r.texto}`)
      }
    }
    expect(malas.join('\n  ')).toBe('')
  })
})
