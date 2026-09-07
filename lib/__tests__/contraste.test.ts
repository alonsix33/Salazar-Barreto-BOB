/**
 * El contraste de **cada** combinación de texto y fondo de `02` §1.
 *
 * Fase 6, punto 7 del verificador. No es una comprobación de estilo: es la
 * medida, con los ratios exactos, y un test que se pone rojo si alguien mueve un
 * color y el contraste cambia sin darse cuenta.
 *
 * Los colores no se escriben aquí: se leen de `app/globals.css`, que es el único
 * sitio donde vive un valor. Si el token cambia, este test mide el nuevo.
 *
 * **Hay dos combinaciones que no llegan a AA**, y `02` §8 afirma que sí. Están
 * marcadas `cumpleAA: false` y explicadas en `docs/verificacion-6.md`: no se
 * corrigen aquí porque la paleta es diseño validado con el usuario y el mockup
 * manda en eso. Lo que sí se hace es medirlas y decirlo, en vez de repetir la
 * afirmación del documento sin comprobarla.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../app/globals.css'),
  'utf8',
)

/** Lee un token de color de `globals.css`. */
function token(nombre: string): string {
  const m = CSS.match(new RegExp(`--color-${nombre}:\\s*([^;]+);`))
  if (!m) throw new Error(`No existe el token --color-${nombre} en globals.css`)
  return m[1]!.trim()
}

/** Un hexadecimal de seis dígitos o una función rgb → canales 0–255 y alfa 0–1. */
function leerColor(valor: string): { r: number; g: number; b: number; a: number } {
  const hex = valor.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const rgb = valor.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)/i)
  if (!rgb) throw new Error(`No sé leer el color: ${valor}`)
  return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: rgb[4] === undefined ? 1 : +rgb[4] }
}

/** Un color translúcido sobre su fondo da un color sólido. */
function componer(
  frente: { r: number; g: number; b: number; a: number },
  fondo: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  return {
    r: frente.r * frente.a + fondo.r * (1 - frente.a),
    g: frente.g * frente.a + fondo.g * (1 - frente.a),
    b: frente.b * frente.a + fondo.b * (1 - frente.a),
  }
}

/** Luminancia relativa, WCAG 2.1 §relative luminance. */
function luminancia({ r, g, b }: { r: number; g: number; b: number }): number {
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** El ratio de contraste, redondeado a dos decimales como lo reporta axe. */
function ratio(textoValor: string, fondoValor: string): number {
  const fondo = componer(leerColor(fondoValor), { r: 255, g: 255, b: 255 })
  const texto = componer(leerColor(textoValor), fondo)
  const a = luminancia(texto)
  const b = luminancia(fondo)
  const claro = Math.max(a, b)
  const oscuro = Math.min(a, b)
  return Math.round(((claro + 0.05) / (oscuro + 0.05)) * 100) / 100
}

/**
 * Cada combinación real de la app, con el ratio que da hoy.
 *
 * `minimo` es lo que se exige: **4.5** para texto normal y **3** para texto
 * grande (≥ 24px, o ≥ 18.66px en negrita) y para elementos de interfaz, que es
 * lo que dice WCAG 2.1 AA. `cumpleAA` es lo que de verdad pasa.
 */
const COMBINACIONES: {
  texto: string
  fondo: string
  uso: string
  minimo: 3 | 4.5
  esperado: number
  cumpleAA: boolean
}[] = [
  // ── Sobre crema, el fondo de la app
  { texto: token('tinta'), fondo: token('crema'), uso: 'texto principal sobre crema', minimo: 4.5, esperado: 17.59, cumpleAA: true },
  { texto: token('gris'), fondo: token('crema'), uso: 'texto de contexto sobre crema', minimo: 4.5, esperado: 4.15, cumpleAA: false },
  { texto: token('gris-claro'), fondo: token('crema'), uso: 'texto terciario sobre crema', minimo: 4.5, esperado: 2.3, cumpleAA: false },
  { texto: token('terra-oscuro'), fondo: token('crema'), uso: 'texto terracota sobre crema', minimo: 4.5, esperado: 4.41, cumpleAA: false },
  { texto: token('verde'), fondo: token('crema'), uso: 'texto verde sobre crema', minimo: 4.5, esperado: 4.77, cumpleAA: true },
  /**
   * **Estos tres son texto corrido, y la justificación anterior era falsa.**
   *
   * Decía «se usan en cifras grandes y en trazos de gráfico, no en texto
   * corrido», y por eso les ponía el mínimo de 3:1. Contado en el repositorio:
   * `ambar` sobre crema es el color de **los quince mensajes de error** de la
   * app, a 13 px; `terra` sobre crema es el de los enlaces —«Marcar todo leído»,
   * «Cambiar»— y el de la regla global de `a {}`. Son texto normal y les toca
   * 4.5:1.
   *
   * Corregir la clasificación no arregla el contraste: lo que hace es dejar de
   * blanquearlo. La decisión sobre la paleta es del usuario y está en
   * `docs/AUDITORIA-FINAL.md`; la paleta ya tiene los tonos que valdrían
   * —`terra-oscuro` 4.41, `terra-texto` 5.99— y existen justamente para esto.
   */
  { texto: token('ambar'), fondo: token('crema'), uso: 'ámbar sobre crema · los mensajes de error', minimo: 4.5, esperado: 3.17, cumpleAA: false },
  { texto: token('terra'), fondo: token('crema'), uso: 'terracota sobre crema · los enlaces', minimo: 4.5, esperado: 3.09, cumpleAA: false },
  // `agua` sí es sobre todo cifra grande y barra de gráfico: 3:1 es su mínimo.
  { texto: token('agua'), fondo: token('crema'), uso: 'agua sobre crema (cifra grande, barra)', minimo: 3, esperado: 3.15, cumpleAA: true },
  { texto: token('apagado'), fondo: token('crema'), uso: 'deshabilitado sobre crema', minimo: 3, esperado: 1.66, cumpleAA: false },
  // ── Sobre papel, las tarjetas elevadas
  { texto: token('tinta'), fondo: token('papel'), uso: 'texto principal sobre tarjeta', minimo: 4.5, esperado: 19.3, cumpleAA: true },
  { texto: token('gris'), fondo: token('papel'), uso: 'contexto sobre tarjeta', minimo: 4.5, esperado: 4.56, cumpleAA: true },
  // ── Sobre noche, el bloque protagonista
  { texto: token('crema'), fondo: token('noche'), uso: 'texto principal sobre noche', minimo: 4.5, esperado: 16.02, cumpleAA: true },
  { texto: token('agua-claro'), fondo: token('noche'), uso: 'agua sobre noche', minimo: 4.5, esperado: 9.89, cumpleAA: true },
  { texto: token('sobre-noche-etiqueta'), fondo: token('noche'), uso: 'etiqueta sobre noche', minimo: 4.5, esperado: 4.85, cumpleAA: true },
  { texto: token('sobre-noche-contexto'), fondo: token('noche'), uso: 'contexto sobre noche', minimo: 4.5, esperado: 5.6, cumpleAA: true },
  { texto: token('sobre-noche-terciario'), fondo: token('noche'), uso: 'terciario sobre noche', minimo: 4.5, esperado: 4.18, cumpleAA: false },
  // ── Sobre los fondos suaves de las píldoras y los avisos
  { texto: token('verde-oscuro'), fondo: token('verde-suave'), uso: 'píldora al día', minimo: 4.5, esperado: 7.53, cumpleAA: true },
  { texto: token('terra-texto'), fondo: token('ambar-suave'), uso: 'aviso de Bob', minimo: 4.5, esperado: 6.52, cumpleAA: true },
]

describe('contraste · cada combinación de 02 §1, medida', () => {
  for (const c of COMBINACIONES) {
    it(`${c.uso} · ${c.esperado}:1${c.cumpleAA ? '' : ' · NO llega a AA'}`, () => {
      const medido = ratio(c.texto, c.fondo)
      // El ratio se fija: si alguien mueve un color, el test dice el nuevo.
      expect(medido, `${c.texto} sobre ${c.fondo}`).toBeCloseTo(c.esperado, 2)
      expect(medido >= c.minimo, `${c.uso}: ${medido}:1 contra un mínimo de ${c.minimo}:1`).toBe(
        c.cumpleAA,
      )
    })
  }

  /**
   * La afirmación de `02` §8 que **no es cierta**.
   *
   * El documento dice que el gris de contexto sobre crema cumple AA para texto
   * normal. Da 4.15:1 y AA para texto normal pide 4.5:1. Este test existe para
   * que la discrepancia no se pierda: si algún día se sube el gris, se pone rojo
   * y hay que venir a actualizar el documento.
   */
  it('el gris sobre crema NO cumple AA, aunque 02 §8 diga que sí', () => {
    expect(ratio(token('gris'), token('crema'))).toBeLessThan(4.5)
  })

  /**
   * Los tonos que la paleta ya tiene para esto **sí llegan** o se acercan.
   *
   * Se fijan aquí para que la conversación con el usuario tenga las cifras
   * delante: cambiar el ámbar de los errores por `terra-texto` pasa de 3.17 a
   * 6.77, y no hace falta inventar ningún color nuevo.
   */
  it('la paleta ya tiene tonos mejores para texto: terra-texto da 6.77', () => {
    expect(ratio(token('terra-texto'), token('crema'))).toBeCloseTo(6.77, 2)
    // Y para los enlaces, `terra-oscuro`, que se queda a un pelo.
    expect(ratio(token('terra-oscuro'), token('crema'))).toBeCloseTo(4.41, 2)
  })

  it('pero sobre papel sí, que es donde vive la mitad del texto de contexto', () => {
    expect(ratio(token('gris'), token('papel'))).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * El color nunca es el único portador de información (`02` §8), y por eso
   * estas cifras no dejan a nadie fuera: los estados llevan texto —`AL DÍA`,
   * `SIN REGISTRAR`— además de color.
   */
  it('la regla que salva a las píldoras: llevan texto además de color', () => {
    const copys = fs.readFileSync(
      path.resolve(import.meta.dirname, '../copys.ts'),
      'utf8',
    )
    for (const etiqueta of ['Al día', 'Sin registrar', 'En verificación']) {
      expect(copys, `la píldora ${etiqueta} tiene que tener texto`).toContain(etiqueta)
    }
  })
})
