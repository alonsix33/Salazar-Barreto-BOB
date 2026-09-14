/**
 * El prompt del sistema, en lo que se puede probar sin llamar al modelo de
 * verdad: que las instrucciones nuevas están escritas, no que el modelo las
 * siga —eso solo se ve preguntándole de verdad, como se hizo antes y después
 * de este cambio, dos veces—.
 *
 * Existe porque un vecino preguntó «¿el 202 pagó más que yo?» sin ser
 * administrador. La primera versión de esta instrucción solo cubría el caso
 * en que el modelo llama a una herramienta y choca con
 * `{"error":"sin-departamento"}` (`dptoDe` en `herramientas.ts`). Probado
 * contra producción, el modelo casi nunca llegaba a llamar la herramienta:
 * como ya sabía por el contexto que no podía ver el dato del 202, saltaba
 * directo a contestar una pregunta distinta —el total del edificio entre
 * meses— sin avisar. La segunda versión cubrió también la decisión de
 * antemano, escrita como regla larga más abajo en el prompt. Vuelta a
 * probar contra producción, siguió sin bastar: cinco de seis veces el
 * modelo la ignoraba igual. La tercera repite la misma regla, corta, pegada
 * al párrafo de permiso —lo primero que el modelo lee sobre lo que puede y
 * no puede hacer— por si la cercanía pesa más que la insistencia. Sigue sin
 * poder probarse aquí si eso alcanza: eso se ve preguntándole de verdad.
 *
 * Las siguientes tres instrucciones —«ayuda» genérica, `explicaPantalla`, y
 * que el hilo es una conversación y no preguntas sueltas— salen de un pedido
 * distinto del usuario: que Bob sepa de la app en sí, no solo de cifras, y
 * que no se sienta como si cada mensaje empezara de cero.
 *
 * Y las dos últimas de un tercer pedido: que Bob entienda una pregunta real,
 * mal escrita, tal como la gente escribe de verdad —«no entiendo esta app»,
 * «que me puedes ayudar»—, y no solo la lista de frases prolijas que se
 * había probado antes. La instrucción de «ayuda» pasó de una lista cerrada
 * de ejemplos a una idea general («mensaje vago, confuso o mal escrito»), y
 * se agregó una nueva para «¿quién eres?», que antes no tenía dónde caer y
 * se respondía con el estado del pago —una respuesta correcta a una
 * pregunta que no era esa—.
 *
 * La última es de un cuarto pedido, y de un caso real: preguntando por el
 * estado de los pagos, Bob contestó con algo como «no hay nada que
 * reclamar». La regla vieja de «moroso/deudor/vencido» prohíbe palabras; la
 * nueva prohíbe la idea de que reclamar, exigir o pedir cuentas sea lo
 * normal cuando algo está pendiente, aunque ninguna palabra de la lista
 * vieja aparezca.
 */

import { describe, expect, it } from 'vitest'
import { promptDelSistema } from '../prompt'
import type { Contexto } from '../tipos'

const VECINO: Contexto = { dpto: '401', mes: '2026-06', esAdmin: false }

describe('promptDelSistema · instrucciones que se agregaron a propósito', () => {
  it('dice qué hacer con el error de "sin-departamento"', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt).toContain('sin-departamento')
  })

  it('cubre también el caso en que decide de antemano, sin llamar a ninguna herramienta', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('lo sepas antes de llamar a una herramienta')
  })

  it('prohíbe sustituir en silencio la pregunta por otra que sí pueda resolver', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('sustituirla en silencio')
  })

  it('repite la regla corta, pegada al párrafo de permiso', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('dilo así de directo')
    // Un admin no tiene esta restricción, así que no debe llevar la frase.
    const admin = promptDelSistema({ ...VECINO, esAdmin: true })
    expect(admin.toLowerCase()).not.toContain('dilo así de directo')
  })

  it('dice que puede sumar varios meses o conceptos, no solo restar de a dos', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('sumar varios meses')
  })

  it('dice qué hacer con un mensaje vago: adelantarse, no preguntar de vuelta', () => {
    const prompt = promptDelSistema(VECINO)
    // No basta con `toContain('AYUDA')`: esa palabra ya aparecía antes en
    // «QUÉ CLASE DE AYUDA SE ESPERA DE TI», así que ese `toContain` pasaba
    // igual con o sin esta instrucción y no probaba nada.
    expect(prompt.toLowerCase()).toContain('el mensaje es vago, confuso o está mal escrito')
    expect(prompt.toLowerCase()).toContain('no preguntes "¿en qué te ayudo?"')
  })

  it('dice qué hacer si preguntan quién es Bob, sin confundirlo con una pregunta de cuota', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt).toContain('SI PREGUNTAN QUIÉN ERES')
  })

  it('dice que puede explicar una pantalla de la app, no solo cifras', () => {
    const prompt = promptDelSistema(VECINO)
    // `explicaPantalla` solo, por sí mismo, no basta: la lista de herramientas
    // ya lo menciona igual. Lo que hace falta es la instrucción específica de
    // cuándo llamarla.
    expect(prompt.toLowerCase()).toContain('y no una cifra concreta, llama a explicapantalla')
  })

  it('dice que es una conversación, no preguntas sueltas', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt).toContain('ESTO ES UNA CONVERSACIÓN')
    expect(prompt.toLowerCase()).toContain('no te vuelvas a presentar')
  })

  /**
   * Encontrado en producción: preguntando por el estado de los pagos, Bob
   * dijo algo con «no hay nada que reclamar». La palabra ya mete la idea de
   * que reclamar sería lo normal si alguien no hubiera pagado, y esa idea
   * es la que el producto no tiene, no solo la palabra exacta.
   */
  it('prohíbe la idea de reclamar o exigirle cuentas a alguien, no solo las palabras de cobranza', () => {
    const prompt = promptDelSistema(VECINO)
    expect(prompt.toLowerCase()).toContain('reclamarle, exigirle o pedirle cuentas')
  })
})
