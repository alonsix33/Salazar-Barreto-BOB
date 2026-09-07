/**
 * La prueba negativa de `scripts/verificar-tokens.mjs`, hecha permanente.
 *
 * Un chequeo que nunca se vio fallar no es un chequeo: es una decoración. Este
 * test le mete a propósito, una por una, cada clase de valor huérfano que el
 * script dice atrapar, y comprueba que **sale en rojo y con código distinto de
 * cero**. Después comprueba que un árbol limpio sale en verde.
 *
 * Los defectos se inyectan en un árbol temporal fuera del repo, con `--raiz`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPT = path.resolve(import.meta.dirname, '../../scripts/verificar-tokens.mjs')
const CSS_ORIGINAL = path.resolve(import.meta.dirname, '../../app/globals.css')

let raiz: string

beforeAll(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'verificar-tokens-'))
  fs.mkdirSync(path.join(raiz, 'app'), { recursive: true })
  fs.mkdirSync(path.join(raiz, 'components'), { recursive: true })
  // El árbol de prueba lleva el globals.css de verdad: si el script lo tratara
  // mal, este test lo vería.
  fs.copyFileSync(CSS_ORIGINAL, path.join(raiz, 'app/globals.css'))
})

afterAll(() => {
  fs.rmSync(raiz, { recursive: true, force: true })
})

/**
 * @param espera Cuántos archivos tiene que revisar el script en el fixture.
 *
 * Declararlo es obligatorio: sin ello, `--raiz` era la puerta de atrás por la
 * que el chequeo salía en verde habiendo mirado un solo fichero.
 */
function correr(espera: number): { codigo: number; salida: string } {
  try {
    const salida = execFileSync('node', [SCRIPT, '--raiz', raiz, '--espera', String(espera)], {
      encoding: 'utf8',
    })
    return { codigo: 0, salida }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { codigo: err.status ?? 1, salida: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

function conDefecto(contenido: string, nombre = 'components/defecto.tsx'): { codigo: number; salida: string } {
  const archivo = path.join(raiz, nombre)
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  fs.writeFileSync(archivo, contenido)
  try {
    // El fixture tiene `app/globals.css` y el archivo con el defecto: dos.
    return correr(2)
  } finally {
    fs.rmSync(archivo, { force: true })
  }
}

/**
 * Los defectos se arman por trozos a propósito.
 *
 * Si estuvieran escritos enteros, este mismo archivo sería un valor huérfano y
 * el script se marcaría a sí mismo. La alternativa —excluir este archivo del
 * chequeo— sería peor: un chequeo con un agujero es un chequeo que miente
 * sobre su alcance.
 */
const DEFECTOS: [regla: string, codigo: string][] = [
  ['hex', `export const c = '` + '#' + `C9773A'`],
  ['rgb', `export const c = '` + 'rgb' + `a(14,14,14,.08)'`],
  ['px-en-style', `export const c = <div style={{ padding: '24` + 'px' + `' }} />`],
  ['px-en-clase-arbitraria', `export const c = <div className="w-[132` + 'px' + `]" />`],
  ['paleta-tailwind', `export const c = <div className="text-` + 'gray' + `-500" />`],
  ['fuente-ajena', `export const c = '` + 'Int' + `er'`],
  ['font-family-suelta', `export const c = '` + 'font-fam' + `ily: Comic Sans'`],
]

describe('verificar-tokens · prueba negativa de cada regla', () => {
  for (const [regla, codigo] of DEFECTOS) {
    it(`atrapa un valor huérfano de tipo "${regla}"`, () => {
      const { codigo: salida, salida: texto } = conDefecto(codigo)
      expect(salida, `el script debería salir con código != 0 ante: ${codigo}`).not.toBe(0)
      expect(texto).toContain(`[${regla}]`)
    })
  }
})

/**
 * La lista blanca perdona **la regla que justifica la excepción**, no la línea.
 *
 * Este bloque es la prueba negativa de eso, y existe porque faltaba: los
 * defectos de arriba se plantan en una línea que no contiene nada más, así que
 * nunca tocaban la lista blanca. Mientras tanto, la lista eximía la línea
 * entera de las siete reglas, y el patrón más común del repo
 * —`<svg viewBox="0 0 24 24" strokeWidth="1.8" className="…">`— dejaba pasar
 * cualquier color o fuente que compartiera línea con el SVG.
 */
describe('verificar-tokens · la lista blanca no es un salvoconducto', () => {
  const CON_PERDON: [regla: string, codigo: string][] = [
    [
      'paleta-tailwind',
      `export const c = <svg viewBox="0 0 24 24" className="text-` + 'red' + `-500" />`,
    ],
    [
      'hex',
      `export const c = <svg strokeWidth="1.8" fill="` + '#' + `FF0000" />`,
    ],
    [
      'fuente-ajena',
      `export const c = <svg viewBox="0 0 24 24" fontFamily="Ro` + 'boto'.slice(0) + `" />`,
    ],
  ]

  for (const [regla, codigo] of CON_PERDON) {
    it(`atrapa "${regla}" aunque la línea lleve un patrón de la lista blanca`, () => {
      const { codigo: salida, salida: texto } = conDefecto(codigo)
      expect(salida, `debería fallar ante: ${codigo}`).not.toBe(0)
      expect(texto).toContain(`[${regla}]`)
    })
  }

  it('y sigue perdonando lo que tiene que perdonar: el px de un viewBox', () => {
    const { codigo } = conDefecto(
      `export const c = <div style={{ width: '24` + 'px' + `' }} data-x="--top" />`,
    )
    expect(codigo).toBe(0)
  })
})

describe('verificar-tokens · las reglas alcanzan a los .mjs', () => {
  it('un color suelto en un script se atrapa', () => {
    // `scripts/` se recorría y se contaba en el resumen, y ninguna regla se le
    // aplicaba: los ocho ficheros son `.mjs`.
    const { codigo, salida } = conDefecto(
      `export const c = '` + '#' + `FF0000'`,
      'lib/trampa.mjs',
    )
    expect(codigo).not.toBe(0)
    expect(salida).toContain('[hex]')
  })
})

describe('verificar-tokens · un árbol limpio pasa', () => {
  it('sale en verde y dice cuántos archivos revisó', () => {
    const { codigo, salida } = correr(1)
    expect(codigo).toBe(0)
    expect(salida).toContain('cero valores huérfanos')
    expect(salida).toMatch(/\d+ archivos/)
  })

  it('no se queda callado si no revisó nada: sale con código 2', () => {
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-vacio-'))
    try {
      let codigo = 0
      try {
        execFileSync('node', [SCRIPT, '--raiz', vacio, '--espera', '0'], { encoding: 'utf8' })
      } catch (e) {
        codigo = (e as { status?: number }).status ?? 1
      }
      expect(codigo).toBe(2)
    } finally {
      fs.rmSync(vacio, { recursive: true, force: true })
    }
  })

  /**
   * Y no se conforma con haber mirado **un** archivo.
   *
   * Un árbol con solo `app/globals.css` dentro daba `✓ cero valores huérfanos ·
   * 1 archivos` y salida 0. Un `--raiz` equivocado pasaba por verde. Ahora el
   * fixture declara cuántos espera, y el árbol de verdad tiene un piso por
   * carpeta.
   */
  it('un fixture que no declara su alcance se rechaza', () => {
    const suelto = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-suelto-'))
    try {
      fs.mkdirSync(path.join(suelto, 'app'), { recursive: true })
      fs.copyFileSync(CSS_ORIGINAL, path.join(suelto, 'app/globals.css'))
      let codigo = 0
      try {
        execFileSync('node', [SCRIPT, '--raiz', suelto], { encoding: 'utf8' })
      } catch (e) {
        codigo = (e as { status?: number }).status ?? 1
      }
      expect(codigo, 'sin --espera tiene que rechazar').toBe(2)

      let codigoMal = 0
      try {
        execFileSync('node', [SCRIPT, '--raiz', suelto, '--espera', '40'], { encoding: 'utf8' })
      } catch (e) {
        codigoMal = (e as { status?: number }).status ?? 1
      }
      expect(codigoMal, 'con un --espera que no cuadra, también').toBe(2)
    } finally {
      fs.rmSync(suelto, { recursive: true, force: true })
    }
  })
})

describe('verificar-tokens · el repo de verdad está limpio', () => {
  it('cero valores huérfanos en app, components, lib, scripts', () => {
    const salida = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    expect(salida).toContain('cero valores huérfanos')
  })
})
