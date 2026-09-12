/**
 * Qué teclado abre cada campo.
 *
 * La regla de `02` §4.6 es dura y fácil de romper sin darse cuenta: **ningún
 * campo numérico usa el teclado del sistema**. El teclado nativo tapa justo el
 * contexto que se está mirando —la lectura del mes pasado, el total— y encima
 * `type="number"` trae la rueda del ratón, las flechas y el punto/coma según el
 * idioma del teléfono. Los números se teclean con el numpad propio.
 *
 * Al revés también: un comentario, una nota o una pregunta a Bob **sí** quieren
 * el alfanumérico completo, con mayúscula inicial y corrección.
 *
 * Esto se comprueba leyendo el código y no en el navegador a propósito: lo que
 * se vigila es que nadie **añada** un campo numérico nativo mañana, y para eso
 * hay que mirar todos los ficheros, no los que un test decidió visitar.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(import.meta.dirname, '../..')

function tsx(dir: string): string[] {
  const salida: string[] = []
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) salida.push(...tsx(rel))
    else if (e.name.endsWith('.tsx')) salida.push(rel)
  }
  return salida
}

const FICHEROS = [...tsx('components'), ...tsx('app')]
const CONTENIDO = new Map(FICHEROS.map((f) => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]))

describe('ningún número se teclea con el teclado del sistema · `02` §4.6', () => {
  it('revisa de verdad los ficheros, y son unos cuantos', () => {
    // Sin esto, un `readdirSync` que devuelva vacío daría «cero culpables» sin
    // haber mirado nada. Es el fallo clásico de un chequeo de este tipo.
    expect(FICHEROS.length).toBeGreaterThan(40)
  })

  for (const prohibido of ['type="number"', 'type="tel"', 'inputMode="numeric"', 'inputMode="decimal"']) {
    it(`no existe ningún ${prohibido}`, () => {
      const culpables = [...CONTENIDO]
        // El propio `CampoNumerico` lo nombra en su comentario, que explica por
        // qué no se usa. Se mira el código, no la prosa.
        .filter(([, c]) => c.split('\n').some((l) => l.includes(prohibido) && !l.trimStart().startsWith('*')))
        .map(([f]) => f)
      expect(culpables, `usan el teclado del sistema para números: ${culpables.join(', ')}`).toEqual([])
    })
  }
})

describe('lo que sí es texto abre el teclado normal', () => {
  /** Fichero, y el campo que tiene que llevar las ayudas de escritura. */
  const DE_TEXTO: [string, string][] = [
    ['components/hojas/HojaBob.tsx', 'la pregunta a Bob'],
    ['components/cierre/Paso7Publicar.tsx', 'las notas del mes'],
    ['components/hojas/HojaCorregir.tsx', 'el motivo de una corrección'],
    ['components/cierre/Paso4Fijos.tsx', 'el nombre de un concepto nuevo'],
  ]

  for (const [fichero, que] of DE_TEXTO) {
    it(`${que} lleva mayúscula inicial automática`, () => {
      expect(CONTENIDO.get(fichero), fichero).toContain('autoCapitalize="sentences"')
    })
  }

  it('la pregunta a Bob dice «enviar» en la tecla de retorno, no «intro»', () => {
    expect(CONTENIDO.get('components/hojas/HojaBob.tsx')).toContain('enterKeyHint="send"')
  })
})

describe('todo lo numérico pasa por el numpad propio', () => {
  it('los pasos del cierre que piden cifras abren el numpad', () => {
    for (const paso of ['Paso1Lecturas', 'Paso2Agua', 'Paso3Luz', 'Paso4Fijos', 'Paso5Puntual']) {
      const c = CONTENIDO.get(`components/cierre/${paso}.tsx`)
      expect(c, `${paso} no existe`).toBeTruthy()
      expect(c, `${paso} pide cifras sin el numpad`).toContain('useNumpad')
    }
  })

  it('el PIN tiene su propio teclado de dígitos, no un campo de texto', () => {
    const c = CONTENIDO.get('components/pantallas/PedirPin.tsx')!
    expect(c).toContain('pin-rejilla')
    expect(c, 'el PIN no puede ser un <input>').not.toMatch(/<input/)
  })
})

describe('las pulsaciones rápidas no pierden dígitos', () => {
  /**
   * La familia de defecto que se llevó por delante una lectura y un PIN: leer
   * el valor del cierre dentro del manejador en vez de la forma funcional de
   * `setState`. Dos toques antes de repintar y uno se come al otro.
   *
   * Se vigila aquí, en los dos teclados a la vez, porque arreglar los dos casos
   * uno por uno no impide el tercero.
   */
  for (const [fichero, teclado] of [
    ['components/Numpad.tsx', 'el numpad del cierre'],
    ['components/pantallas/PedirPin.tsx', 'el teclado del PIN'],
  ] as const) {
    it(`${teclado} usa la forma funcional de setState`, () => {
      const c = CONTENIDO.get(fichero)!
      const cuerpo = c
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
        .join('\n')
      // Nada de `setValor(valor + ...)` ni `setPin(pin.slice(...))`.
      expect(cuerpo, `${teclado} lee el estado del cierre`).not.toMatch(
        /set(Valor|Pin)\(\s*(valor|pin)[.\s+]/,
      )
      expect(cuerpo, `${teclado} tendría que usar setX((v) => …)`).toMatch(/set(Valor|Pin)\(\s*\(/)
    })
  }
})
