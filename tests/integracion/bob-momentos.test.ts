/**
 * Los textos automáticos de Bob, pasando por el modelo de verdad.
 *
 * «De verdad» quiere decir por el camino completo: `mejorarMomento`, el
 * adaptador de DeepSeek —simulado interceptando `fetch`, porque un test que
 * depende de lo que conteste hoy un modelo de fuera no es un test— y las mismas
 * guardas que la hoja de Bob.
 *
 * Lo que se comprueba es sobre todo que **cuando algo falla no pasa nada**.
 * Esta es la diferencia de diseño con la hoja: ahí el vecino preguntó y sabe que
 * espera; aquí nadie preguntó, así que un fallo tiene que ser invisible. Si el
 * modelo tarda, se cae, se calla o escribe una cifra que no le dieron, lo que
 * queda en pantalla es el texto del catálogo, que ya era correcto.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mejorarMomento, textoDeterminista } from '@/lib/bob/momento'
import { MOMENTOS } from '@/lib/bob/momentos'
import type { Contexto } from '@/lib/bob/tipos'
import { prisma, resembrar } from './entorno'

const YO: Contexto = { dpto: '401', mes: '2026-06', esAdmin: false }

/** Datos reales de junio de 2026, los de la semilla. */
const DATOS_AGUA = {
  m3: 78,
  nombreMes: 'junio',
  anteriores: [
    { mes: 'mayo', valor: 78 },
    { mes: 'abril', valor: 76 },
  ],
}

const fetchDeVerdad = globalThis.fetch

beforeAll(async () => {
  await resembrar()
}, 60_000)

afterEach(() => {
  globalThis.fetch = fetchDeVerdad
  delete process.env.BOB_MODO
  delete process.env.BOB_SIN_MODELO
  delete process.env.DEEPSEEK_API_KEY
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Un DeepSeek que contesta lo que se le diga. Una sola vuelta, sin herramientas. */
function modeloQueDice(texto: string) {
  return async (): Promise<Response> =>
    new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: texto } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
}

function conModelo(texto: string) {
  process.env.BOB_MODO = 'deepseek'
  process.env.DEEPSEEK_API_KEY = 'de-mentira'
  globalThis.fetch = modeloQueDice(texto) as unknown as typeof fetch
}

describe('sin clave, la pantalla se queda con lo suyo', () => {
  it('devuelve null y no llama a nadie', async () => {
    let llamó = false
    globalThis.fetch = (() => {
      llamó = true
      throw new Error('no se debería llamar a DeepSeek sin clave')
    }) as unknown as typeof fetch
    expect(await mejorarMomento('cierre-agua', DATOS_AGUA, YO)).toBeNull()
    expect(llamó, 'se llamó a DeepSeek sin clave').toBe(false)
  })

  it('con BOB_SIN_MODELO tampoco, aunque haya clave · el freno de mano', async () => {
    /**
     * Antes este caso era `BOB_MODO=determinista` con clave puesta, y era
     * justo el fallo de producción: la clave estaba, `BOB_MODO` sobraba de una
     * época anterior, y Bob llevaba semanas contestando con el catálogo sin que
     * nada lo dijera. Ahora manda la clave y el freno explícito es
     * `BOB_SIN_MODELO`, que nadie tiene puesta por herencia.
     */
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    process.env.BOB_SIN_MODELO = '1'
    let llamó = false
    globalThis.fetch = (() => {
      llamó = true
      throw new Error('no')
    }) as unknown as typeof fetch
    expect(await mejorarMomento('cierre-agua', DATOS_AGUA, YO)).toBeNull()
    expect(llamó).toBe(false)
  })
})

describe('con clave, el modelo puede reescribirlo', () => {
  it('una frase buena se acepta y se devuelve', async () => {
    conModelo('Los 78 m³ de junio están en línea con mayo 78 y abril 76.')
    const r = await mejorarMomento('cierre-agua', DATOS_AGUA, YO)
    expect(r).toBe('Los 78 m³ de junio están en línea con mayo 78 y abril 76.')
  })

  it('lo que pase de dos frases se recorta, no se descarta', async () => {
    conModelo('Junio llegó con 78 m³. Es lo mismo que mayo. Y que abril. Y que marzo.')
    const r = await mejorarMomento('cierre-agua', DATOS_AGUA, YO)
    expect(r).toBe('Junio llegó con 78 m³. Es lo mismo que mayo.')
  })

  it('puede repetir una cifra que el catálogo derivó y está en pantalla', async () => {
    // 17.40 menos 12.00 son 5.40, y el 5.40 no está en los datos: sale del
    // texto que ya se está enseñando. Sin esa parte de la guarda, esta
    // respuesta correcta se descartaría.
    const datos = { mesesConConsumo: 8, m3: 17.4, promedio: 12 }
    conModelo('Este mes gastaste 5.40 m³ más que tu promedio.')
    expect(await mejorarMomento('mi-consumo', datos, YO)).toBe(
      'Este mes gastaste 5.40 m³ más que tu promedio.',
    )
  })
})

describe('cuando el modelo falla, no se nota', () => {
  const FALLOS: [string, () => void][] = [
    [
      'una cifra que nadie le dio',
      () => conModelo('Los 78 m³ de junio están en línea con mayo 78 y abril 64.'),
    ],
    ['una respuesta vacía', () => conModelo('   ')],
    [
      'un mes del que no se habló',
      () => conModelo('En 2026-01 fueron 78 m³ también.'),
    ],
    [
      'la API devolviendo un error',
      () => {
        process.env.BOB_MODO = 'deepseek'
        process.env.DEEPSEEK_API_KEY = 'de-mentira'
        globalThis.fetch = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch
      },
    ],
    [
      'la red caída',
      () => {
        process.env.BOB_MODO = 'deepseek'
        process.env.DEEPSEEK_API_KEY = 'de-mentira'
        globalThis.fetch = (async () => {
          throw new Error('sin red')
        }) as unknown as typeof fetch
      },
    ],
  ]

  for (const [nombre, montar] of FALLOS) {
    it(`${nombre} → null, y la pantalla no se entera`, async () => {
      montar()
      expect(await mejorarMomento('cierre-agua', DATOS_AGUA, YO)).toBeNull()
    })
  }

  it('y lo que queda en pantalla sigue siendo correcto', () => {
    // El suelo no es un texto de relleno: es la respuesta buena.
    expect(textoDeterminista('cierre-agua', DATOS_AGUA)).toBe(
      '78 m³ está en línea con los últimos meses: mayo 78 y abril 76.',
    )
  })
})

describe('la propuesta de corrección no pasa por el modelo', () => {
  it('ni siquiera se le pregunta', async () => {
    process.env.BOB_MODO = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    let llamó = false
    globalThis.fetch = (() => {
      llamó = true
      throw new Error('no')
    }) as unknown as typeof fetch
    const r = await mejorarMomento('cierre-propuesta', { texto: 'La lectura del 301 baja.' }, YO)
    expect(r).toBeNull()
    expect(llamó, 'se le pasó al modelo un texto que lleva la cifra del botón de al lado').toBe(false)
  })
})

describe('todo queda registrado, salga como salga', () => {
  /**
   * Se borra lo anterior en vez de ordenar por fecha: la columna es un
   * `DateTime` y dos registros del mismo test caen en el mismo milisegundo más
   * a menudo de lo que uno cree. Un test que depende de cuál de los dos
   * empatados devuelve Postgres primero es un test que falla un martes.
   */
  const soloElDeAhora = async (fn: () => Promise<unknown>) => {
    await prisma.consultaBob.deleteMany({ where: { pregunta: { startsWith: '[momento]' } } })
    await fn()
    const filas = await prisma.consultaBob.findMany({ where: { pregunta: { startsWith: '[momento]' } } })
    expect(filas, 'tenía que quedar exactamente un registro').toHaveLength(1)
    return filas[0]!
  }

  it('una respuesta aceptada se guarda como deepseek', async () => {
    conModelo('Los 78 m³ de junio están en línea con mayo 78 y abril 76.')
    const fila = await soloElDeAhora(() => mejorarMomento('cierre-agua', DATOS_AGUA, YO))
    expect(fila.pregunta).toBe('[momento] cierre-agua')
    expect(fila.modo).toBe('deepseek')
    expect(fila.motivoCaida).toBeNull()
  })

  it('una descartada se guarda con el motivo y con el texto que sí se vio', async () => {
    conModelo('Los 78 m³ de junio están en línea con mayo 78 y abril 64.')
    const fila = await soloElDeAhora(() => mejorarMomento('cierre-agua', DATOS_AGUA, YO))
    expect(fila.modo).toBe('determinista')
    expect(fila.motivoCaida).toBe('numero-inventado')
    // Lo que se guarda es lo que el vecino vio, no lo que el modelo escribió.
    expect(fila.respuesta).toBe(textoDeterminista('cierre-agua', DATOS_AGUA))
  })

  it('un momento que no se le pasa al modelo no ensucia el registro', async () => {
    await prisma.consultaBob.deleteMany({ where: { pregunta: { startsWith: '[momento]' } } })
    await mejorarMomento('cierre-propuesta', { texto: 'La lectura del 301 baja.' }, YO)
    expect(
      await prisma.consultaBob.count({ where: { pregunta: { startsWith: '[momento]' } } }),
    ).toBe(0)
  })
})

describe('los siete momentos siguen siendo los que la interfaz usa', () => {
  it('cada uno produce texto con sus datos mínimos', () => {
    const MINIMOS: Record<string, Record<string, unknown>> = {
      'inicio-pagos': { nombreMes: 'junio', avisados: [], sinRegistrar: [] },
      'mi-consumo': { mesesConConsumo: 0 },
      'cierre-consumo-alto': { dpto: '301' },
      'cierre-agua': { m3: 78, nombreMes: 'junio', anteriores: [] },
      'cierre-luz': { luz: 456.5, anteriores: [] },
      'cierre-sin-cifra': { concepto: 'Pozo a tierra' },
      'cierre-propuesta': { texto: 'Algo pasó con el 301.' },
    }
    for (const [id, datos] of Object.entries(MINIMOS)) {
      const t = MOMENTOS[id as keyof typeof MOMENTOS].determinista(datos)
      expect(t.length, id).toBeGreaterThan(15)
      expect(t, `${id} dejó un hueco sin rellenar`).not.toMatch(/undefined|NaN|\[object/)
    }
  })
})
