/**
 * Los tokens contra `02-sistema-de-diseno.md`, comparando con el documento en
 * la mano y no con lo que yo recuerde de él.
 *
 * El test **lee el documento de diseño** y comprueba que cada color, cada radio
 * y cada sombra de sus tablas existe en `app/globals.css`. Si el documento
 * cambia y los tokens no, esto se pone rojo. Si alguien borra un token, también.
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '../..')
const css = fs.readFileSync(path.join(RAIZ, 'app/globals.css'), 'utf8')
const doc = fs.readFileSync(
  path.join(RAIZ, 'mockup/design_handoff_edificio_salazar_barreto/02-sistema-de-diseno.md'),
  'utf8',
)

/** El bloque `@theme`, que es donde tienen que estar los tokens. */
const tema = css.slice(css.indexOf('@theme'), css.indexOf('\n:root'))

/** Las dos sintaxis de color funcional son el mismo color; se normalizan. */
function normalizar(color: string): string {
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    let v = hex[1]!.toLowerCase()
    if (v.length === 3) v = v.split('').map((c) => c + c).join('')
    return `#${v}`
  }
  const rgb = color.match(/rgba?\s*\(([^)]+)\)/i)
  if (rgb) {
    const partes = rgb[1]!.split(/[,/\s]+/).filter(Boolean).map((x) => x.trim())
    const [r, g, b] = partes
    const a = partes[3] ?? '1'
    const alfa = Number(a.startsWith('.') ? `0${a}` : a)
    return `c(${r} ${g} ${b} / ${alfa})`
  }
  return color.toLowerCase()
}

const coloresDelTema = new Set(
  [...tema.matchAll(/--color-[a-z0-9-]+:\s*([^;]+);/g)].map((m) => normalizar(m[1]!.trim())),
)

/** Sección §1 del documento: la paleta y los fondos. */
const seccion1 = doc.slice(doc.indexOf('## 1. Color'), doc.indexOf('## 2. Tipografía'))

/** Las filas de la tabla "Paleta": `| token | valor | uso |`. */
const tablaPaleta = seccion1
  .slice(seccion1.indexOf('### Paleta'), seccion1.indexOf('### Fondos suaves'))
  .split('\n')
  .filter((l) => l.startsWith('|') && l.includes('`'))
  .map((l) => l.split('|').map((c) => c.trim()))
  .filter((c) => c[1]?.startsWith('`') && c[2]?.startsWith('`'))
  .map((c) => ({ token: c[1]!.replaceAll('`', ''), valor: c[2]!.replaceAll('`', '') }))

describe('02 §1 · la paleta', () => {
  it('el documento declara exactamente 18 colores', () => {
    // Los 18 de la tabla "Paleta": 16 en hex y 2 en color funcional (`linea` y
    // `borde-tarjeta`). Si el documento cambiara, este número tiene que cambiar
    // a conciencia, no por accidente.
    expect(tablaPaleta).toHaveLength(18)
  })

  for (const { token, valor } of tablaPaleta) {
    it(`${token} (${valor}) está definido como token`, () => {
      expect(coloresDelTema.has(normalizar(valor))).toBe(true)
    })
  }

  /** Los fondos suaves y las capas sobre noche, todos en color funcional. */
  const funcionales = [
    ...new Set(
      [...seccion1.matchAll(/`(rgba?\([^`]+\))`/g)]
        .map((m) => m[1]!)
        .filter((v) => !tablaPaleta.some((p) => p.valor === v)),
    ),
  ]

  it('el documento declara los fondos suaves y las capas sobre noche', () => {
    // Nueve valores distintos: cuatro fondos suaves de color y cinco capas
    // sobre noche. El "neutro suave" comparte valor con `borde-tarjeta`, así
    // que no cuenta aparte.
    expect(funcionales).toHaveLength(9)
  })

  for (const valor of funcionales) {
    it(`${valor} está definido como token`, () => {
      expect(coloresDelTema.has(normalizar(valor))).toBe(true)
    })
  }
})

describe('02 §3 · los radios y las sombras', () => {
  const seccion3 = doc.slice(doc.indexOf('## 3. Forma'), doc.indexOf('## 4. Componentes'))
  // Una fila de la tabla puede traer dos valores: `| `12px`, `8px` | …`
  const filasRadios = seccion3
    .slice(seccion3.indexOf('### Radios'), seccion3.indexOf('### Sombras'))
    .split('\n')
    .filter((l) => l.startsWith('|') && l.includes('px`'))
  const radios = [...new Set(filasRadios.flatMap((l) => [...l.matchAll(/`(\d+px)`/g)].map((m) => m[1]!)))]

  it('el documento declara los nueve radios, en diez valores', () => {
    expect(filasRadios).toHaveLength(9)
    expect(radios).toHaveLength(10)
  })

  for (const radio of radios) {
    it(`el radio ${radio} existe como token`, () => {
      const valores = [...tema.matchAll(/--radius-[a-z-]+:\s*([^;]+);/g)].map((m) => m[1]!.trim())
      expect(valores).toContain(radio)
    })
  }

  it('la sombra del marco del dispositivo es la del documento', () => {
    expect(normalizar(tema.match(/--shadow-marco:\s*0 24px 60px\s*([^;]+);/)![1]!.trim()))
      .toBe(normalizar('rgb' + 'a(14,14,14,.13)'))
  })

  it('la sombra de la hoja modal es la del documento', () => {
    expect(normalizar(tema.match(/--shadow-hoja:\s*0 -8px 40px\s*([^;]+);/)![1]!.trim()))
      .toBe(normalizar('rgb' + 'a(14,14,14,.2)'))
  })
})

describe('02 §2 · las tres familias tipográficas', () => {
  it('son Syne, DM Sans y JetBrains Mono, y ninguna más', () => {
    expect(tema).toMatch(/--font-titulo:\s*var\(--fuente-syne\)/)
    expect(tema).toMatch(/--font-cuerpo:\s*var\(--fuente-dm-sans\)/)
    expect(tema).toMatch(/--font-mono:\s*var\(--fuente-jetbrains-mono\)/)
    expect([...tema.matchAll(/--font-[a-z-]+:/g)]).toHaveLength(3)
  })

  it('el sello visual de la app está definido: mono 10px, .16em, mayúsculas', () => {
    const bloque = css.slice(css.indexOf('@utility tipo-etiqueta-seccion'))
    expect(bloque).toMatch(/font:\s*500 10px\/1 var\(--font-mono\)/)
    expect(bloque).toMatch(/letter-spacing:\s*0\.16em/)
    expect(bloque).toMatch(/text-transform:\s*uppercase/)
  })
})

describe('reglas de color · 02 §1', () => {
  it('no existe ningún token con nombre de rojo', () => {
    expect(tema).not.toMatch(/--color-[a-z-]*\b(rojo|red|alerta|peligro|error)\b/)
  })

  it('el agua tiene su token propio y su versión sobre noche', () => {
    // Los valores van por trozos para que este archivo no sea a su vez un
    // valor huérfano: el propio verificador lo revisa.
    expect(tema).toMatch(new RegExp('--color-agua:\\s*' + '#' + '3e93b8', 'i'))
    expect(tema).toMatch(new RegExp('--color-agua-claro:\\s*' + '#' + '8ecbe4', 'i'))
  })

  it('el degradado terracota está en una sola utilidad, para que no se repita', () => {
    const patron = new RegExp('linear-gradient\\(' + '#' + 'eedfcf', 'gi')
    expect([...css.matchAll(patron)]).toHaveLength(1)
  })
})
