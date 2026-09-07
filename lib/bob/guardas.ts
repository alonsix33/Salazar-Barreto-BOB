/**
 * Las guardas duras. Fase 8 §8.4.
 *
 * **En código, no en el prompt.** Un prompt se le pide al modelo; esto se le
 * impone. La diferencia importa porque el modelo es de fuera: cambia de versión
 * sin avisar, y una instrucción que hoy respeta mañana puede no respetarla.
 *
 * Aquí viven dos de las cinco: el límite de longitud y —la que de verdad
 * sostiene todo— **la verificación de números**. Las otras tres son
 * estructurales y viven donde tienen que vivir: la de escritura, en que
 * `herramientas.ts` solo importa lectores; la del registro y la del tiempo de
 * espera, en `index.ts`.
 */

import type { Llamada } from './tipos'

/**
 * Recorta a dos frases. `05` §3: *«Dos líneas. Si necesita más, el momento está
 * mal diseñado.»*
 *
 * El corte es por frase y no por caracteres a propósito: cortar a los 180
 * caracteres deja frases a medias, y una frase a medias sobre dinero se lee
 * peor que una frase de más.
 *
 * Los decimales no confunden al separador porque el corte exige **espacio en
 * blanco detrás** del punto: en «S/ 1,355.25» al punto le sigue un dígito.
 */
export function aDosFrases(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  const frases = limpio.split(/(?<=[.!?…])\s+/)
  if (frases.length <= 2) return limpio
  return frases.slice(0, 2).join(' ')
}

/**
 * Los meses en formato `AAAA-MM`, que se comprueban como cadena y no como
 * número: si se dejaran pasar por el extractor darían «2026» y «06» sueltos, y
 * ese «6» abriría la puerta a cualquier otro 6 inventado.
 */
const MES = /\b\d{4}-\d{2}\b/g

/**
 * Convierte un trozo de texto numérico a su forma canónica.
 *
 * `1,355.25` → `1355.25`; `6,20` → `6.2`; `8.42` → `8.42`. Devuelve `null` si
 * no es un número de verdad.
 */
function canonico(crudo: string): string | null {
  let t = crudo.replace(/\s/g, '')
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  else if (/^\d+,\d+$/.test(t)) t = t.replace(',', '.')
  t = t.replace(/,/g, '')
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return String(n)
}

/** Todos los números de un texto, ya canónicos, y los meses aparte. */
function piezasDeTexto(texto: string): { numeros: Set<string>; meses: Set<string> } {
  const meses = new Set(texto.match(MES) ?? [])
  const numeros = new Set<string>()
  for (const trozo of texto.replace(MES, ' ').match(/\d[\d.,]*/g) ?? []) {
    // Un punto o una coma final es puntuación, no parte del número.
    const c = canonico(trozo.replace(/[.,]+$/, ''))
    if (c !== null) numeros.add(c)
  }
  return { numeros, meses }
}

/**
 * Lo que las herramientas devolvieron, aplanado a números y meses.
 *
 * Recorre **los valores, no las claves**. Con las claves dentro, `m3` habría
 * metido un `3` en la lista de números permitidos, y `precioM3` otro: la guarda
 * habría dejado pasar cualquier «3» inventado. Es la clase de agujero que se
 * abre solo, sin que nada se ponga rojo.
 */
export function piezasPermitidas(llamadas: Llamada[]): { numeros: Set<string>; meses: Set<string> } {
  const numeros = new Set<string>()
  const meses = new Set<string>()

  const permitirNumero = (n: number) => {
    if (!Number.isFinite(n)) return
    numeros.add(String(n))
    // La respuesta se escribe redondeada a dos decimales: `fmt(6.204)` es
    // «6.20», y el extractor lo lee como 6.2. Sin esto, una cifra correcta
    // tumbaría la respuesta.
    numeros.add(String(Math.round(n * 100) / 100))
    numeros.add(String(Math.round(n)))
    numeros.add(String(Math.abs(n)))
    numeros.add(String(Math.abs(Math.round(n * 100) / 100)))
  }

  const recorrer = (valor: unknown) => {
    if (valor === null || valor === undefined) return
    if (typeof valor === 'number') return permitirNumero(valor)
    if (typeof valor === 'string') {
      const p = piezasDeTexto(valor)
      for (const m of p.meses) meses.add(m)
      for (const n of p.numeros) numeros.add(n)
      return
    }
    if (Array.isArray(valor)) return valor.forEach(recorrer)
    if (typeof valor === 'object') return Object.values(valor as object).forEach(recorrer)
  }

  for (const ll of llamadas) {
    recorrer(ll.resultado)
    // Los argumentos también: si se preguntó por 2026-05, ese mes se puede
    // nombrar aunque la herramienta responda que no está cerrado.
    recorrer(ll.argumentos)
  }

  // Los tamaños del edificio no son cifras que Bob deduzca: son la cantidad de
  // cosas que la propia herramienta devolvió. Contarlas no es inventarlas.
  for (const ll of llamadas) {
    const r = ll.resultado
    if (r && typeof r === 'object') {
      for (const v of Object.values(r as object)) {
        if (Array.isArray(v)) permitirNumero(v.length)
      }
    }
  }

  return { numeros, meses }
}

/**
 * **La guarda que impide que Bob invente cifras.**
 *
 * Devuelve la lista de números de la respuesta que no salen de ninguna
 * herramienta. Si devuelve algo, la respuesta se tira entera y se cae al
 * determinista: no se corrige, no se recorta, no se avisa. Una respuesta con
 * una cifra inventada no es una respuesta con un error; es una respuesta que no
 * se puede publicar.
 *
 * Se comprueba contra las llamadas **de esa conversación**, no contra la base:
 * el criterio no es «existe en algún sitio» sino «Bob lo miró».
 */
export function numerosInventados(texto: string, llamadas: Llamada[]): string[] {
  const permitido = piezasPermitidas(llamadas)
  const dicho = piezasDeTexto(texto)
  const fuera: string[] = []
  for (const m of dicho.meses) if (!permitido.meses.has(m)) fuera.push(m)
  for (const n of dicho.numeros) if (!permitido.numeros.has(n)) fuera.push(n)
  return fuera
}
