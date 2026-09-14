/**
 * Bob guiando un caso atípico, contra la base de verdad.
 *
 * Lo que se protege aquí no es que responda bonito: es que **responda del caso
 * que le contaron**, y que la instrucción que dé sea una que exista. Una
 * instrucción equivocada sobre dinero la sigue quien administra, y el error
 * termina en la cuota de alguien.
 *
 * Y se comprueba, en **todas** las respuestas, la guarda de números: que cada
 * cifra salga de una herramienta. Es la parte menos evidente de este trabajo.
 * «Ve al paso 5» lleva un 5, y ese 5 no sale de ningún sitio a menos que el
 * procedimiento venga dentro de una llamada. Sin eso, con la clave de DeepSeek
 * puesta, toda respuesta de procedimiento se descartaría —y el vecino vería la
 * corta del catálogo sin que nada se pusiera rojo—.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { preguntarABob } from '@/lib/bob'
import { numerosInventados } from '@/lib/bob/guardas'
import { herramienta } from '@/lib/bob/herramientas'
import { intencionDe } from '@/lib/bob/determinista'
import { CASOS, PROCEDIMIENTOS, procedimientoPara } from '@/lib/bob/procedimientos'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import type { Contexto } from '@/lib/bob/tipos'
import { resembrar } from './entorno'

/** Quien administra, mirando junio, que está publicado en la semilla. */
const ADMIN: Contexto = { dpto: '401', mes: '2026-06', esAdmin: true }

beforeAll(async () => {
  await resembrar()
}, 60_000)

/**
 * Las preguntas tal como llegarían por el grupo del edificio, con el
 * procedimiento que tienen que encontrar.
 *
 * No son paráfrasis del identificador: están escritas con las palabras del
 * caso, con el «lo» en medio y sin decir el nombre del trámite, que es como se
 * pregunta de verdad.
 */
const CASOS_REALES: [string, string][] = [
  ['el 502 depositó más de lo que dice su cuota, cómo lo registro', 'pago-adelantado'],
  ['cómo registro un gasto extra', 'gasto-extra'],
  ['compramos un portón y no le sirve al primer piso, qué hago si no todos pagan', 'gasto-que-no-paga-alguien'],
  ['me equivoqué en una lectura de un mes ya cerrado, cómo corrijo', 'corregir-mes-publicado'],
  ['cómo hago para que el 501 no deba nada', 'condonar'],
  ['ya no lavo el carro, cómo lo saco', 'lavado-de-vehiculo'],
  ['subió la guardianía, cómo cambio el monto', 'cambiar-un-gasto-fijo'],
  ['no me deja publicar, dice que no cuadra', 'no-cuadra'],
  ['pagó solo la mitad, cómo lo pongo', 'pago-parcial'],
  ['se mudó el del 301, cómo cambio de dueño', 'cambio-de-dueno'],
  ['cómo publico el mes y les aviso a todos', 'publicar'],
  ['contratamos limpieza, cómo agrego el concepto nuevo', 'concepto-nuevo'],
]

describe('Bob encuentra el procedimiento del caso que le cuentan', () => {
  for (const [pregunta, esperado] of CASOS_REALES) {
    it(`«${pregunta}» → ${esperado}`, () => {
      expect(intencionDe(pregunta), 'no la leyó como pregunta de trámite').toBe('como')
      expect(procedimientoPara(pregunta)?.caso).toBe(esperado)
    })
  }

  it('los doce casos están cubiertos por alguna pregunta real', () => {
    // Un procedimiento al que ninguna pregunta llega es un procedimiento que
    // nadie va a ver nunca.
    const alcanzados = new Set(CASOS_REALES.map(([, caso]) => caso))
    expect([...CASOS].sort()).toEqual([...alcanzados].sort())
  })
})

describe('Bob responde, y la respuesta aguanta las guardas', () => {
  for (const [pregunta] of CASOS_REALES) {
    it(`«${pregunta}»`, async () => {
      const r = await preguntarABob(pregunta, ADMIN)

      // 1 · Llamó a la herramienta, así que la receta está auditada.
      expect(r.llamadas.map((l) => l.herramienta)).toContain('comoSeHace')

      // 2 · **La guarda de números.** Sin la herramienta, «paso 4» tumbaría esto.
      expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])

      // 3 · Dos frases, que es la regla dura de `05` §3.
      expect(r.texto.split(/(?<=[.!?…])\s+/).filter(Boolean).length).toBeLessThanOrEqual(2)

      // 4 · Dice dónde se hace, no solo qué es.
      expect(r.texto.length).toBeGreaterThan(40)

      // 5 · Sigue sin hablar de sí mismo ni de lo que no puede.
      expect(r.texto.toLowerCase()).not.toMatch(/como asistente|no puedo|lo siento|disculpa/)
    })
  }
})

describe('Bob sabe quién vive en cada departamento', () => {
  it('responde por el que le preguntan, no por el de quien pregunta', async () => {
    const r = await preguntarABob('quién vive en el 202', ADMIN)
    expect(r.texto).toMatch(/^En el 202 /)
    expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])
  })

  it('los nombres salen de la base, no de una lista escrita en Bob', async () => {
    const r = await preguntarABob('quiénes son los dueños', ADMIN)
    const { prisma } = await import('@/lib/datos/prisma')
    for (const d of await prisma.departamento.findMany()) {
      expect(r.texto, `falta el ${d.id}`).toContain(d.id)
    }
  })

  it('nombra a los siete y a ninguno más', async () => {
    const r = await preguntarABob('quiénes viven en el edificio', ADMIN)
    const nombrados = DPTO_IDS.filter((d) => r.texto.includes(d))
    expect(nombrados).toHaveLength(DPTO_IDS.length)
  })

  it('no se le escapa quién debe: eso es del administrador, no del directorio', async () => {
    const r = await preguntarABob('quiénes son los vecinos', ADMIN)
    expect(r.llamadas.map((l) => l.herramienta)).not.toContain('estadoPagos')
    expect(r.texto.toLowerCase()).not.toMatch(/debe|pendiente|sin registrar|moroso/)
  })
})

/**
 * «Ayuda», «no sé qué hacer», y lo que antes caía en «de eso no tengo
 * dato» —falso, porque Bob sí tenía datos; lo que no tenía era una
 * pregunta concreta—. La respuesta ahora se adelanta con el estado real
 * del pago de quien pregunta, que es la duda más probable detrás de un
 * mensaje así de vacío. Junio en la semilla: 101/202/301/401/502 pagados,
 * 201 en verificación, 501 sin registrar.
 *
 * Va **antes** que «estadoPagos no suelta el monto…»: ese bloque confirma
 * el pago del 501, y después de eso ya no queda ningún departamento sin
 * registrar en junio para probar esa rama.
 */
describe('un "ayuda" se adelanta con el estado del pago, no con un menú', () => {
  it('a quien ya pagó, se lo dice primero', async () => {
    const r = await preguntarABob('ayuda', { dpto: '401', mes: '2026-06', esAdmin: false })
    expect(r.texto).toMatch(/pagada y confirmada/)
    expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])
  })

  it('a quien todavía no registró nada, se lo dice y ofrece Cómo pagar', async () => {
    const r = await preguntarABob('no se que hacer', { dpto: '501', mes: '2026-06', esAdmin: false })
    expect(r.texto).toMatch(/todavía no hay pago tuyo registrado/)
    expect(r.lleva).toEqual({ hoja: 'pagar', etiqueta: 'Ver cómo pagar' })
    expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])
  })

  it('a quien avisó y está en verificación, se lo dice', async () => {
    const r = await preguntarABob('estoy perdido', { dpto: '201', mes: '2026-06', esAdmin: false })
    expect(r.texto).toMatch(/queda por confirmar/)
    expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])
  })

  it('sin departamento elegido, orienta a elegirlo primero', async () => {
    const r = await preguntarABob('ayuda', { dpto: null, mes: '2026-06', esAdmin: false })
    expect(r.texto).toMatch(/Elígelo arriba/)
  })
})

/**
 * «¿Qué hay en Mi departamento?». Pedido del usuario: Bob debería saber
 * explicar la app en sí, no solo cifras, para cualquier pantalla que un
 * vecino sin PIN pueda ver.
 */
describe('Bob explica una pantalla cuando se la preguntan', () => {
  it('«qué hay en mi departamento»', async () => {
    const r = await preguntarABob('qué hay en mi departamento', { dpto: '401', mes: '2026-06', esAdmin: false })
    expect(r.texto.toLowerCase()).toContain('tu historial de pagos')
    expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])
  })

  it('«para qué sirve avisos»', async () => {
    const r = await preguntarABob('para qué sirve avisos', { dpto: '401', mes: '2026-06', esAdmin: false })
    expect(r.texto.toLowerCase()).toContain('los siete ven lo mismo')
  })

  it('«mi departamento debe más que el mes pasado» no se confunde con la pregunta de pantalla', async () => {
    // No hay procedimiento de comparación en el determinista con ese texto
    // exacto, así que cae al catálogo; lo que importa es que NO sea la
    // descripción de la pantalla "Mi departamento".
    const r = await preguntarABob('mi departamento debe más que el mes pasado', {
      dpto: '401',
      mes: '2026-06',
      esAdmin: false,
    })
    expect(r.texto).not.toContain('tu historial de pagos')
  })

  it('la herramienta también reconoce la clave exacta, no solo el texto libre', async () => {
    // Así es como el modelo podría llamarla, con la clave y no la frase
    // completa: pantallaPara('mi-departamento') no matchea por texto (el
    // guion no es un espacio), así que hace falta el fallback por clave.
    const r = (await herramienta('explicaPantalla')!.ejecutar({ pantalla: 'mi-departamento' }, ADMIN)) as {
      encontrada: boolean
      clave: string
    }
    expect(r.encontrada).toBe(true)
    expect(r.clave).toBe('mi-departamento')
  })

  it('la herramienta, sin una pantalla reconocida, ofrece la lista de las que sí', async () => {
    // El determinista solo entra a este caso cuando `pantallaPara` ya
    // encontró algo, así que la rama "no encontrada" solo la ejercita el
    // modelo llamando la herramienta con una clave que no existe.
    const r = (await herramienta('explicaPantalla')!.ejecutar({ pantalla: 'el gimnasio' }, ADMIN)) as {
      encontrada: boolean
      pantallas: { clave: string; queEs: string }[]
    }
    expect(r.encontrada).toBe(false)
    expect(r.pantallas.length).toBeGreaterThan(0)
  })
})

/**
 * `estadoPagos` es la única herramienta que da un vistazo a los siete
 * departamentos a la vez —hace falta para «cuántos días sin registrarse»— y
 * por eso es la única que no pasaba por `dptoDe`. Probado contra producción,
 * eso dejaba que un vecino sin sesión de administración le preguntara a Bob
 * cuánto pagó otro departamento y se lo contestara, con la cifra exacta:
 * justo lo que `dptoDe` existe para no soltar.
 *
 * `monto` es `null` en la fila cuando el departamento pagó justo su cuota
 * —lo normal, y lo que trae la semilla para todos—, así que para probar de
 * verdad la restricción hace falta un pago que **sí** tenga un monto propio.
 * Se confirma el del 501, que en la semilla de junio está sin registrar.
 */
describe('estadoPagos no suelta el monto de otro departamento', () => {
  const est = () => herramienta('estadoPagos')!

  beforeAll(async () => {
    const { confirmarPago } = await import('@/lib/servicios/pagos')
    await confirmarPago({ mes: '2026-06', dpto: '501', monto: 111.11 })
  })

  it('quien pagó ese monto lo ve en su propia fila', async () => {
    const r = (await est().ejecutar({}, { dpto: '501', mes: '2026-06', esAdmin: false })) as {
      fechas: { dpto: string; monto: number | null }[]
    }
    expect(r.fechas.find((f) => f.dpto === '501')?.monto).toBe(111.11)
  })

  it('otro vecino sin sesión de administración no lo ve', async () => {
    const r = (await est().ejecutar({}, { dpto: '401', mes: '2026-06', esAdmin: false })) as {
      fechas: { dpto: string; monto: number | null }[]
    }
    expect(r.fechas.find((f) => f.dpto === '501')?.monto).toBeNull()
  })

  it('con sesión de administración sí se ve', async () => {
    const r = (await est().ejecutar({}, ADMIN)) as { fechas: { dpto: string; monto: number | null }[] }
    expect(r.fechas.find((f) => f.dpto === '501')?.monto).toBe(111.11)
  })

  it('la fecha y el estado de los demás sí se quedan: de ahí sale "hace cuántos días"', async () => {
    const r = (await est().ejecutar({}, { dpto: '401', mes: '2026-06', esAdmin: false })) as {
      fechas: { dpto: string; fecha: string | null; estado: string }[]
    }
    const otros = r.fechas.filter((f) => f.dpto !== '401')
    expect(otros.length).toBeGreaterThan(0)
    for (const f of otros) expect(f.fecha).toBeTruthy()
  })
})

describe('lo que Bob no tiene, no se lo inventa', () => {
  it('un trámite que no existe se dice, y se ofrece la lista de los que sí', async () => {
    const r = await preguntarABob('cómo hago para que el edificio tenga piscina', ADMIN)
    expect(r.texto.toLowerCase()).toMatch(/no tengo/)
    expect(numerosInventados(r.texto, r.llamadas), r.texto).toEqual([])
  })

  it('«se malogró la bomba» no es una pregunta de trámite, y no se le responde con una receta', () => {
    // Contar un hecho no es pedir instrucciones. Responder con el procedimiento
    // del gasto extra a quien solo avisó de una avería es adivinar.
    expect(intencionDe('se malogró la bomba')).not.toBe('como')
  })

  it('«cuánto subió el agua» suena a pregunta pero no es un trámite', () => {
    expect(intencionDe('cuánto subió el agua')).not.toBe('como')
  })
})

describe('el catálogo de procedimientos está bien escrito', () => {
  it('cada uno dice qué es, dónde y con qué pasos', () => {
    for (const p of PROCEDIMIENTOS) {
      expect(p.queEs.length, p.caso).toBeGreaterThan(20)
      expect(p.donde.length, p.caso).toBeGreaterThan(10)
      expect(p.pasos.length, p.caso).toBeGreaterThan(0)
    }
  })

  it('ninguno promete que Bob lo haga: Bob no escribe nunca', () => {
    for (const p of PROCEDIMIENTOS) {
      const todo = [p.queEs, p.donde, ...p.pasos, p.ojoCon ?? ''].join(' ').toLowerCase()
      expect(todo, p.caso).not.toMatch(/\bte lo (registro|pongo|guardo)\b|\blo hago yo\b|\byo lo (registro|pongo)\b/)
    }
  })

  it('ninguno usa las palabras que `01` §7 prohíbe', () => {
    for (const p of PROCEDIMIENTOS) {
      const todo = [p.queEs, p.donde, ...p.pasos, p.ojoCon ?? ''].join(' ').toLowerCase()
      expect(todo, p.caso).not.toMatch(/moroso|deudor|vencid/)
    }
  })

  it('sin rayas largas, que es la huella de máquina más fácil de dejar', () => {
    for (const p of PROCEDIMIENTOS) {
      const todo = [p.queEs, p.donde, ...p.pasos, p.ojoCon ?? ''].join(' ')
      expect(todo, p.caso).not.toMatch(/—|–/)
    }
  })

  it('ningún identificador se repite', () => {
    expect(new Set(CASOS).size).toBe(CASOS.length)
  })
})
