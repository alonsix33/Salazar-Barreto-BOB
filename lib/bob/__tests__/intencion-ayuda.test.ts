/**
 * `intencionDe` reconociendo un «ayuda» o un «no sé qué hacer».
 *
 * Lo que se protege aquí no es solo que lo reconozca: es que lo reconozca
 * **por igualdad exacta**, no por «contiene». Con un `includes` normal,
 * «no sé cuánto pagué» —una pregunta de verdad, sobre la cuota— habría caído
 * en `ayuda` por el «no se» suelto, y el vecino habría recibido una
 * orientación genérica en vez de su cuota. Eso es lo que más se prueba aquí:
 * lo que sigue sin caer en `ayuda` a pesar de sonar parecido.
 */

import { describe, expect, it } from 'vitest'
import { intencionDe } from '../determinista'

describe('intencionDe reconoce el "ayuda" genérico', () => {
  it.each(['ayuda', 'Ayuda', '¡ayuda!', 'ayudame', 'no se que hacer', 'no entiendo', 'estoy perdido', 'que hago'])(
    '«%s» → ayuda',
    (frase) => {
      expect(intencionDe(frase)).toBe('ayuda')
    },
  )
})

describe('lo que suena parecido pero es una pregunta de verdad, y no se le roba', () => {
  it('«no sé cuánto pagué» sigue siendo una pregunta de cuota, no un "ayuda"', () => {
    expect(intencionDe('no sé cuánto pagué')).not.toBe('ayuda')
  })

  it('«no sé si ya pagué el agua» sigue hablando de agua, no de "ayuda"', () => {
    expect(intencionDe('no sé si ya pagué el agua')).not.toBe('ayuda')
  })

  it('una frase larga que solo menciona "ayuda" de pasada no cuenta', () => {
    expect(intencionDe('necesito que alguien me ayude a entender mi consumo de agua')).not.toBe('ayuda')
  })
})
