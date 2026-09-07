/**
 * Bob, contra la base de verdad. Verificador de la Fase 8, puntos 1 a 6.
 *
 * Los tests de `lib/bob/__tests__/guardas.test.ts` prueban las guardas con
 * llamadas de mentira. Estos las prueban **enchufadas**: la respuesta que sale
 * por `preguntarABob`, con las herramientas leyendo la base sembrada y con el
 * registro escribiéndose.
 *
 * DeepSeek se simula interceptando `fetch`. No hay clave de verdad en CI, y aun
 * habiéndola, un test que depende de lo que conteste hoy un modelo de fuera no
 * es un test.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { preguntarABob } from '@/lib/bob'
import { COPYS } from '@/lib/copys'
import type { Contexto } from '@/lib/bob/tipos'
import { prisma, resembrar } from './entorno'

/** Junio de 2026, publicado en la semilla, y el 401, que tiene lavado. */
const YO: Contexto = { dpto: '401', mes: '2026-06', esAdmin: false }

const fetchDeVerdad = globalThis.fetch

beforeAll(async () => {
  await resembrar()
}, 60_000)

afterEach(() => {
  globalThis.fetch = fetchDeVerdad
  delete process.env.BOB_MODO
  delete process.env.DEEPSEEK_API_KEY
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Responde como responde la API de DeepSeek, con el texto que se le pase. */
function deepseekQueDice(texto: string, herramientas: { nombre: string; argumentos: object }[] = []) {
  let vuelta = 0
  return async (_url: unknown, opciones?: RequestInit): Promise<Response> => {
    void opciones
    const primera = vuelta++ === 0
    const mensaje =
      primera && herramientas.length > 0
        ? {
            role: 'assistant',
            content: null,
            tool_calls: herramientas.map((h, i) => ({
              id: `c${i}`,
              type: 'function',
              function: { name: h.nombre, arguments: JSON.stringify(h.argumentos) },
            })),
          }
        : { role: 'assistant', content: texto }
    return new Response(JSON.stringify({ choices: [{ message: mensaje }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

describe('1 · con BOB_MODO=determinista y sin clave, Bob responde', () => {
  it('contesta las cuatro preguntas sugeridas, todas con dato', async () => {
    for (const pregunta of COPYS.bob.sugeridas) {
      const r = await preguntarABob(pregunta, YO)
      expect(r.modo, pregunta).toBe('determinista')
      expect(r.motivoCaida, pregunta).toBeNull()
      expect(r.texto.length, pregunta).toBeGreaterThan(20)
      // `05` §3: siempre con el dato. Ninguna de las cuatro se contesta sin cifra.
      expect(r.texto, pregunta).toMatch(/\d/)
      // Dos frases como mucho.
      expect(r.texto.split(/(?<=[.!?…])\s+/).length, pregunta).toBeLessThanOrEqual(2)
    }
  })

  it('cada cifra que dice sale de una herramienta que llamó', async () => {
    const { numerosInventados } = await import('@/lib/bob/guardas')
    for (const pregunta of COPYS.bob.sugeridas) {
      const r = await preguntarABob(pregunta, YO)
      expect(numerosInventados(r.texto, r.llamadas), `${pregunta} → ${r.texto}`).toEqual([])
    }
  })

  it('registra la conversación entera · §8.4.4', async () => {
    await prisma.consultaBob.deleteMany()
    const r = await preguntarABob('¿Cuánto debo este mes?', YO)
    const filas = await prisma.consultaBob.findMany()
    expect(filas).toHaveLength(1)
    expect(filas[0]!.pregunta).toBe('¿Cuánto debo este mes?')
    expect(filas[0]!.respuesta).toBe(r.texto)
    expect(filas[0]!.dpto).toBe('401')
    expect(filas[0]!.modo).toBe('determinista')
    expect((filas[0]!.llamadas as unknown[]).length).toBeGreaterThan(0)
  })
})

describe('2 · la guarda de números, enchufada', () => {
  it('descarta la respuesta del modelo con una cifra inventada y cae al determinista', async () => {
    process.env.BOB_MODO = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    globalThis.fetch = deepseekQueDice(
      'Tu cuota de junio es S/ 999.99 y el mes pasado fue S/ 812.40.',
      [{ nombre: 'cuotaDe', argumentos: { mes: '2026-06', dpto: '401' } }],
    ) as typeof fetch

    const r = await preguntarABob('¿Cuánto debo este mes?', YO)
    expect(r.motivoCaida).toBe('numero-inventado')
    expect(r.modo).toBe('determinista')
    expect(r.texto).not.toContain('999.99')
  })

  it('publica la respuesta del modelo cuando sus cifras sí salen de la herramienta', async () => {
    process.env.BOB_MODO = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    // La cuota real del 401 en junio, tomada de la propia herramienta.
    const { HERRAMIENTAS } = await import('@/lib/bob/herramientas')
    const cuota = HERRAMIENTAS.find((h) => h.nombre === 'cuotaDe')!
    const c = (await cuota.ejecutar({ mes: '2026-06', dpto: '401' }, YO)) as { total: number }
    const { fmt } = await import('@/lib/calculo/redondeo')

    globalThis.fetch = deepseekQueDice(`Tu cuota de junio es S/ ${fmt(c.total)}.`, [
      { nombre: 'cuotaDe', argumentos: { mes: '2026-06', dpto: '401' } },
    ]) as typeof fetch

    const r = await preguntarABob('¿Cuánto debo este mes?', YO)
    expect(r.motivoCaida).toBeNull()
    expect(r.modo).toBe('deepseek')
    expect(r.texto).toContain(fmt(c.total))
  })
})

describe('3 · la guarda de longitud, enchufada', () => {
  it('recorta a dos frases una respuesta de diez párrafos', async () => {
    process.env.BOB_MODO = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    const diez = Array.from(
      { length: 10 },
      () => 'Aquí Bob se pone a explicar largo y tendido. Y sigue explicando sin parar.',
    ).join('\n\n')
    globalThis.fetch = deepseekQueDice(diez) as typeof fetch

    const r = await preguntarABob('cuéntame de todo', YO)
    expect(r.modo).toBe('deepseek')
    expect(r.texto.split(/(?<=[.!?…])\s+/)).toHaveLength(2)
    expect(r.texto).toBe('Aquí Bob se pone a explicar largo y tendido. Y sigue explicando sin parar.')
  })
})

describe('4 · Bob no escribe · §8.4.2', () => {
  const ordenes = [
    'Confirma mi pago de junio',
    'Cambia mi lectura a 500',
    'Publica el mes de julio',
    'Registra que ya pagué',
    'Corrige el recibo de agua',
    'Borra el gasto de guardianía',
  ]

  it('se niega y dice quién sí puede', async () => {
    for (const orden of ordenes) {
      const r = await preguntarABob(orden, YO)
      expect(r.texto, orden).toContain('quien administra')
      // `05` §3: sin hablar de sí mismo. Nada de «como asistente, no puedo».
      expect(r.texto.toLowerCase(), orden).not.toContain('como asistente')
      expect(r.texto.toLowerCase(), orden).not.toContain('lo siento')
    }
  })

  it('el módulo de herramientas no contiene ni una escritura', () => {
    const fuente = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../lib/bob/herramientas.ts'),
      'utf8',
    )
    expect(fuente).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/)
    expect(fuente).not.toMatch(/\$executeRaw|\$transaction/)
  })

  it('ninguna herramienta deja rastro en la base', async () => {
    const { HERRAMIENTAS } = await import('@/lib/bob/herramientas')
    const antes = await censo()
    for (const h of HERRAMIENTAS) await h.ejecutar({}, { ...YO, esAdmin: true })
    expect(await censo()).toEqual(antes)
  })
})

describe('5 · Bob no habla del banco · `05` §2', () => {
  it('dice que no tiene acceso y quién lo verifica', async () => {
    for (const pregunta of ['¿Viste mi depósito?', '¿Llegó mi transferencia?', '¿Qué dice el banco?']) {
      const r = await preguntarABob(pregunta, YO)
      /**
       * Se afirma **el contenido, no la redacción**.
       *
       * La versión anterior comparaba contra la frase literal «No tengo acceso
       * a la cuenta del banco». Al mejorar el texto, el test se puso rojo sin
       * que nada del contrato de `05` §2 se hubiera roto: un test atado a las
       * letras convierte cada corrección de estilo en un falso positivo, y a
       * los tres falsos positivos alguien lo relaja de verdad.
       *
       * Las tres cosas que sí tienen que estar: que el límite se diga, que se
       * nombre a quién sí puede, y contra qué lo verifica.
       */
      expect(r.texto, pregunta).toMatch(/no los veo yo|no tengo acceso|no veo (los )?dep[óo]sitos/i)
      expect(r.texto, pregunta).toContain('quien administra')
      expect(r.texto, pregunta).toMatch(/estado de cuenta|banco/i)
      // Nunca una fecha ni un monto de depósito: eso sería inventarlo.
      expect(r.texto, pregunta).not.toMatch(/dep[óo]sito de S\//i)
    }
  })

  it('aunque el modelo diga que vio un depósito, no llega al vecino', async () => {
    process.env.BOB_MODO = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    globalThis.fetch = deepseekQueDice('Vi un depósito de S/ 343.48 el 24 de julio.') as typeof fetch

    const r = await preguntarABob('¿Viste mi depósito?', YO)
    expect(r.motivoCaida).toBe('numero-inventado')
    expect(r.texto).toMatch(/no los veo yo|no tengo acceso|no veo (los )?dep[óo]sitos/i)
    expect(r.texto).toContain('quien administra')
  })
})

describe('6 · DeepSeek tardando 30 segundos', () => {
  it('cae al determinista en ocho, no se queda colgado', async () => {
    process.env.BOB_MODO = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'de-mentira'
    globalThis.fetch = ((_url: unknown, opciones?: RequestInit) =>
      new Promise<Response>((_resolver, rechazar) => {
        const treintaSegundos = setTimeout(() => rechazar(new Error('no debería llegar aquí')), 30_000)
        opciones?.signal?.addEventListener('abort', () => {
          clearTimeout(treintaSegundos)
          const e = new Error('The operation was aborted.')
          e.name = 'AbortError'
          rechazar(e)
        })
      })) as typeof fetch

    const arranque = Date.now()
    const r = await preguntarABob('¿Cuánto debo este mes?', YO)
    const tardo = Date.now() - arranque

    expect(r.motivoCaida).toBe('tiempo-agotado')
    expect(r.modo).toBe('determinista')
    expect(tardo).toBeLessThan(12_000)
    expect(tardo).toBeGreaterThanOrEqual(8_000)
    // Y el vecino no ve un error: ve una respuesta con su cifra.
    expect(r.texto).toMatch(/\d/)
  }, 40_000)

  it('con BOB_MODO=deepseek pero sin clave, ni lo intenta', async () => {
    process.env.BOB_MODO = 'deepseek'
    globalThis.fetch = (() => {
      throw new Error('no debería llamarse a la red sin clave')
    }) as unknown as typeof fetch

    const r = await preguntarABob('¿Cuánto debo este mes?', YO)
    expect(r.motivoCaida).toBe('sin-clave')
    expect(r.modo).toBe('determinista')
  })
})

describe('un vecino no ve los datos de otro', () => {
  it('preguntar por el 501 desde el 401 no devuelve la cuota del 501', async () => {
    const { HERRAMIENTAS } = await import('@/lib/bob/herramientas')
    const cuota = HERRAMIENTAS.find((h) => h.nombre === 'cuotaDe')!
    const r = (await cuota.ejecutar({ mes: '2026-06', dpto: '501' }, YO)) as { error?: string }
    expect(r.error).toBe('sin-departamento')
  })

  it('con sesión de administración sí', async () => {
    const { HERRAMIENTAS } = await import('@/lib/bob/herramientas')
    const cuota = HERRAMIENTAS.find((h) => h.nombre === 'cuotaDe')!
    const r = (await cuota.ejecutar({ mes: '2026-06', dpto: '501' }, { ...YO, esAdmin: true })) as {
      dpto?: string
      total?: number
    }
    expect(r.dpto).toBe('501')
    expect(r.total).toBeGreaterThan(0)
  })
})

/** Cuántas filas hay de cada cosa. Si Bob escribiera, esto cambiaría. */
async function censo() {
  return {
    lecturas: await prisma.lectura.count(),
    recibos: await prisma.recibo.count(),
    pagos: await prisma.pago.count(),
    cierres: await prisma.cierre.count(),
    gastos: await prisma.gastoExtra.count(),
    fijos: await prisma.gastoFijo.count(),
    reasignaciones: await prisma.reasignacionAgua.count(),
    auditoria: await prisma.auditoria.count(),
  }
}
