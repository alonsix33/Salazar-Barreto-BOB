/**
 * Los colores de la pantalla de «sin conexión» son los tokens de verdad.
 *
 * Esa pantalla la sirve el service worker cuando la app no pudo cargar, así que
 * va como HTML suelto con los colores escritos a mano: no hay hoja de estilos
 * que resuelva una variable. Por eso `verificar-tokens` la exenta de `hex` y de
 * `font-family-suelta`.
 *
 * Una exención sin nada que la ate es una puerta abierta, así que esto es lo
 * que la cierra: cada color del service worker tiene que ser, literalmente, un
 * token declarado en `globals.css`. Si alguien cambia la paleta y se olvida de
 * esta pantalla, aquí sale rojo.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(import.meta.dirname, '../..')
const SW = fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8')
const CSS = fs.readFileSync(path.join(RAIZ, 'app/globals.css'), 'utf8')

/** Lee un token de `globals.css`. Lanza si no existe, que ya es el hallazgo. */
function token(nombre: string): string {
  const m = CSS.match(new RegExp(`--color-${nombre}:\\s*([^;]+);`))
  if (!m) throw new Error(`No existe el token --color-${nombre} en globals.css`)
  return m[1]!.trim().toLowerCase()
}

/** Cada color del service worker, con el token del que tiene que salir. */
const COLORES: [string, string][] = [
  ['crema', 'el fondo en claro'],
  ['tinta', 'el texto en claro'],
  ['noche', 'el fondo en oscuro'],
  ['terra', 'el botón de reintentar'],
  ['papel', 'el texto del botón'],
]

describe('la pantalla sin conexión usa la paleta de la app', () => {
  it('el service worker tiene esa pantalla', () => {
    // Si alguien la quita, esta exención sobra y hay que borrarla.
    expect(SW, 'ya no existe respuestaSinRed(): quita la exención de verificar-tokens').toContain(
      'function respuestaSinRed()',
    )
  })

  for (const [nombre, para] of COLORES) {
    it(`${para} es --color-${nombre}`, () => {
      expect(SW.toLowerCase(), `--color-${nombre} (${token(nombre)}) no aparece en sw.js`).toContain(
        token(nombre),
      )
    })
  }

  it('no hay ningún otro color suelto que no salga de la paleta', () => {
    // Se miran solo los hexadecimales de esa pantalla, no los de todo el fichero.
    const bloque = SW.slice(SW.indexOf('function respuestaSinRed()'))
    const hex = [...new Set((bloque.match(/#[0-9a-f]{3,8}/gi) ?? []).map((h) => h.toLowerCase()))]
    // Todos salen de la paleta, sin excepciones escritas a mano: un literal
    // aquí sería el mismo agujero que este test existe para cerrar, y además
    // `verificar-tokens` lo caza, que es como se encontró.
    const permitidos = new Set(COLORES.map(([n]) => token(n)))
    const fuera = hex.filter((h) => !permitidos.has(h))
    expect(fuera, `colores que no son de la paleta: ${fuera.join(', ')}`).toEqual([])
  })
})
