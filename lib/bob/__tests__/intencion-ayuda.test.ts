/**
 * Lo que antes era la intención «ayuda», con lista cerrada de frases exactas.
 *
 * Pedido del usuario: nadie escribe una pregunta bien redactada, y una lista
 * de frases exactas —«ayuda», «no sé qué hacer»— nunca cubre cómo la gente
 * escribe de verdad: «no entiendo esta app», «que me puedes ayudar», con
 * faltas, sin tildes, de cualquier forma. La solución no fue ampliar la
 * lista: fue quitarla. Ahora «ayuda» no es una intención aparte, es lo que
 * queda cuando **nada más** encaja —el `default` del switch en
 * `determinista.ts`—, así que cualquier mensaje vago cae ahí sin necesitar
 * una frase exacta. Lo que se prueba aquí es justo eso: que `intencionDe`
 * ya no reconoce «ayuda» como algo especial, sino que la deja caer a
 * `'nada'`, que es adonde tiene que caer para que `default` la agarre.
 *
 * El comportamiento de verdad —que `default` responda con el estado del
 * pago en vez de «de eso no tengo dato»— se prueba contra la base real en
 * `tests/integracion/bob-sabe-del-edificio.test.ts`, con mensajes tan
 * desordenados como los que de verdad llegarían.
 */

import { describe, expect, it } from 'vitest'
import { intencionDe } from '../determinista'

describe('un "ayuda" ya no es una intención aparte: cae a "nada", y de ahí a `default`', () => {
  it.each([
    'ayuda',
    'Ayuda',
    '¡ayuda!',
    'ayudame',
    'no se que hacer',
    'no entiendo',
    'no entiendo esta app',
    'no entiendo nada de esto',
    'estoy perdido',
    'que hago',
    'que me puedes ayudar',
    'no se ni por donde empezar',
  ])('«%s» → nada (y de ahí, default)', (frase) => {
    expect(intencionDe(frase)).toBe('nada')
  })
})

describe('lo que sí encaja en algo más específico no cae en "nada"', () => {
  it('«no sé cuánto pagué» sigue sin encajar en nada específico hoy, y eso está bien: default ya resuelve esto', () => {
    // No hay una intención de "cuánto pagué" con ese verbo exacto, así que
    // esto también cae a `default` — y `default` ahora sí contesta con el
    // estado del pago, que es justo lo que se preguntó. No hace falta que
    // esto sea una intención aparte para estar bien resuelto.
    expect(intencionDe('no sé cuánto pagué')).toBe('nada')
  })

  it('«no sé si ya pagué el agua» encaja en algo específico (banco, por "ya pagué"), no en "nada"', () => {
    // No importa cuál específicamente: lo que importa es que la mención de
    // "agua" y "ya pagué" no se pierdan cayendo al genérico.
    expect(intencionDe('no sé si ya pagué el agua')).not.toBe('nada')
  })

  it('«mi cuota» dentro de una frase más larga sigue yendo a `cuota`', () => {
    expect(intencionDe('no entiendo cuánto es mi cuota')).toBe('cuota')
  })
})

describe('«¿quién eres?» tiene su propia respuesta, no la genérica', () => {
  it.each(['quién eres', '¿Quién eres?', 'con quién hablo', 'eres un bot', 'eres una persona real'])(
    '«%s» → identidad',
    (frase) => {
      expect(intencionDe(frase)).toBe('identidad')
    },
  )
})
