/**
 * Los siete sitios donde Bob habla sin que nadie le pregunte.
 *
 * Lo que se protege aquí son dos cosas distintas.
 *
 * La primera: **lo que se pinta sin modelo no cambió.** Estos textos vivían
 * dentro de sus componentes y se movieron a un solo sitio; si el traslado
 * cambió una palabra, esto da rojo. Un refactor que además reescribe copy es
 * dos cambios disfrazados de uno.
 *
 * La segunda, y la que de verdad importa: **la guarda de números funciona en
 * este camino**. Es la parte fácil de romper sin que se note, porque romperla
 * no rompe la pantalla: simplemente todas las respuestas del modelo se
 * descartarían en silencio, la app se vería igual de bien, y DeepSeek estaría
 * cobrando por nada.
 */

import { describe, expect, it } from 'vitest'
import { MOMENTOS, MOMENTO_IDS, type MomentoId } from '../momentos'
import { numerosInventados } from '../guardas'
import { COPYS } from '@/lib/copys'
import type { Llamada } from '../tipos'

/**
 * Lo mismo que hace `momento.ts`: los datos **y el texto que ya se ve**, con
 * forma de llamada. Las dos piezas, porque el catálogo deriva cifras que no
 * están en los datos y el modelo tiene que poder repetirlas.
 */
const comoLlamada = (id: string, datos: Record<string, unknown>, yaEnPantalla: string): Llamada[] => [
  { herramienta: `momento:${id}`, argumentos: {}, resultado: datos, ms: 0 },
  { herramienta: `momento:${id}:texto`, argumentos: {}, resultado: { yaEnPantalla }, ms: 0 },
]

/**
 * Un caso realista por momento, con el texto que tiene que salir.
 *
 * Los textos están copiados de los componentes **tal como estaban antes** de
 * moverlos aquí. No se escribieron mirando la implementación nueva.
 */
const CASOS: [MomentoId, Record<string, unknown>, string][] = [
  [
    'inicio-pagos',
    { nombreMes: 'julio', avisados: [], sinRegistrar: [] },
    'Julio cerró completo: los siete al día.',
  ],
  [
    'inicio-pagos',
    { nombreMes: 'julio', avisados: ['202'], sinRegistrar: [] },
    'Va bien: solo falta confirmar el pago del 202.',
  ],
  [
    'inicio-pagos',
    { nombreMes: 'julio', avisados: [], sinRegistrar: ['501'] },
    'Falta que el 501 avise.',
  ],
  [
    'inicio-pagos',
    { nombreMes: 'julio', avisados: [], sinRegistrar: ['501', '202', '301'] },
    'Falta que 3 departamentos avisen.',
  ],
  [
    'mi-consumo',
    { mesesConConsumo: 2, m3: 9, promedio: 6 },
    'Todavía no tengo suficientes meses para ver un patrón.',
  ],
  [
    'mi-consumo',
    { mesesConConsumo: 8, m3: 17.4, promedio: 12 },
    'Es tu mes más alto del año, 5.40 m³ sobre tu promedio.',
  ],
  [
    'mi-consumo',
    { mesesConConsumo: 8, m3: 4, promedio: 12 },
    'Este mes consumiste bastante menos de lo habitual.',
  ],
  [
    'mi-consumo',
    { mesesConConsumo: 8, m3: 12.2, promedio: 12 },
    'Tu consumo está estable, cerca de tu promedio de siempre.',
  ],
  ['cierre-consumo-alto', { dpto: '301' }, COPYS.cierre.consumoAlto('301')],
  [
    'cierre-agua',
    { m3: 81, nombreMes: 'julio', anteriores: [] },
    '81 m³ es lo que llegó en el recibo de julio. Es el primer mes, así que todavía no hay con qué compararlo.',
  ],
  [
    'cierre-agua',
    { m3: 81, nombreMes: 'julio', anteriores: [{ mes: 'junio', valor: 78 }, { mes: 'mayo', valor: 78 }] },
    '81 m³ está en línea con los últimos meses: junio 78 y mayo 78.',
  ],
  [
    'cierre-agua',
    { m3: 96, nombreMes: 'julio', anteriores: [{ mes: 'junio', valor: 78 }, { mes: 'mayo', valor: 78 }] },
    '96 m³ es bastante más que los últimos meses (junio 78 y mayo 78). ¿Lo confirmas?',
  ],
  [
    'cierre-luz',
    { luz: 520.9, anteriores: [] },
    'S/ 520.90 de luz común este mes. Es el primero, así que todavía no hay con qué compararlo.',
  ],
  [
    'cierre-luz',
    { luz: 460, anteriores: [{ mes: 'junio', valor: 456.5 }, { mes: 'mayo', valor: 378.1 }] },
    'S/ 460.00 está en línea con los últimos meses: junio S/ 456.50 y mayo S/ 378.10.',
  ],
  [
    'cierre-luz',
    { luz: 900, anteriores: [{ mes: 'junio', valor: 456.5 }, { mes: 'mayo', valor: 378.1 }] },
    'S/ 900.00 es bastante más que los últimos meses (junio S/ 456.50 y mayo S/ 378.10). ¿Lo confirmas?',
  ],
  [
    'cierre-sin-cifra',
    { concepto: 'Pozo a tierra' },
    'Pozo a tierra sigue sin cifra. Puedes dejarlo así y ponerlo cuando lo tengas.',
  ],
  ['cierre-propuesta', { texto: 'La lectura del 301 parece un dedazo.' }, 'La lectura del 301 parece un dedazo.'],
]

describe('lo que Bob dice sin modelo es lo de siempre', () => {
  for (const [id, datos, esperado] of CASOS) {
    it(`${id} · ${esperado.slice(0, 45)}…`, () => {
      expect(MOMENTOS[id].determinista(datos)).toBe(esperado)
    })
  }
})

describe('la guarda de números vale en este camino', () => {
  for (const [id, datos, esperado] of CASOS) {
    it(`${id}: su propio texto pasa la guarda`, () => {
      // Si esto fallara, el modelo nunca podría decir lo mismo que el catálogo:
      // toda respuesta buena se descartaría por «cifra inventada».
      expect(numerosInventados(esperado, comoLlamada(id, datos, esperado)), esperado).toEqual([])
    })
  }

  it('una cifra que no está en los datos se detecta', () => {
    const datos = { m3: 81, nombreMes: 'julio', anteriores: [{ mes: 'junio', valor: 78 }] }
    const base = MOMENTOS['cierre-agua'].determinista(datos)
    const mentira = '81 m³ está en línea: junio fueron 78 y mayo 64.'
    expect(numerosInventados(mentira, comoLlamada('cierre-agua', datos, base))).toContain('64')
  })

  it('un mes que no está en los datos también', () => {
    const datos = { luz: 520.9, anteriores: [] }
    const base = MOMENTOS['cierre-luz'].determinista(datos)
    expect(numerosInventados('En 2026-03 fue distinto.', comoLlamada('cierre-luz', datos, base))).toContain('2026-03')
  })
})

describe('el catálogo de momentos está completo y es auditable', () => {
  it('los siete dicen dónde salen y cuándo', () => {
    expect(MOMENTO_IDS).toHaveLength(7)
    for (const id of MOMENTO_IDS) {
      expect(MOMENTOS[id].donde.length, id).toBeGreaterThan(10)
      expect(MOMENTOS[id].cuando.length, id).toBeGreaterThan(10)
      expect(MOMENTOS[id].id, 'el id de la clave y el del objeto no concuerdan').toBe(id)
    }
  })

  it('los mejorables tienen qué pedirle al modelo, y el que no, no', () => {
    for (const id of MOMENTO_IDS) {
      const m = MOMENTOS[id]
      const pedido = m.pregunta({ dpto: '301', concepto: 'Pozo a tierra', nombreMes: 'julio' })
      if (m.mejorable) expect(pedido.length, id).toBeGreaterThan(30)
      else expect(pedido, id).toBe('')
    }
  })

  it('la propuesta de corrección no se le pasa al modelo', () => {
    // Lleva la cifra que el botón de al lado va a escribir. Ver el comentario
    // en `momentos.ts`: es el único de los siete que no se redacta.
    expect(MOMENTOS['cierre-propuesta'].mejorable).toBe(false)
  })

  it('ninguna petición al modelo lleva cifras: las cifras van en los datos', () => {
    // Una cifra escrita en la petición no está en `datos`, así que el modelo la
    // repetiría y la guarda tiraría la respuesta entera.
    for (const id of MOMENTO_IDS) {
      const pedido = MOMENTOS[id].pregunta({ dpto: '301', concepto: 'Pozo a tierra', nombreMes: 'julio' })
      const cifras = (pedido.replace(/\b301\b|\bPozo a tierra\b/g, '').match(/\d[\d.,]*/g) ?? [])
      expect(cifras, `${id} lleva cifras en la petición: ${cifras.join(', ')}`).toEqual([])
    }
  })

  it('ninguno acusa a nadie ni se disculpa · `01` §7 y `05` §3', () => {
    for (const [id, datos] of CASOS) {
      const t = MOMENTOS[id].determinista(datos).toLowerCase()
      expect(t, id).not.toMatch(/moroso|deudor|vencid|lo siento|disculpa|como asistente/)
      expect(t, id).not.toMatch(/—|–/)
    }
  })

  it('todos caben en dos frases', () => {
    for (const [id, datos] of CASOS) {
      const frases = MOMENTOS[id].determinista(datos).split(/(?<=[.!?…])\s+/).filter(Boolean)
      expect(frases.length, id).toBeLessThanOrEqual(2)
    }
  })
})
