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

/** Una fecha completa. De aquí salen los «hace once días». */
const FECHA = /\b\d{4}-\d{2}-\d{2}\b/g

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
export function piezasPermitidas(llamadas: Llamada[]): {
  numeros: Set<string>
  meses: Set<string>
  fechas: Set<string>
  crudos: number[]
} {
  const numeros = new Set<string>()
  const meses = new Set<string>()
  /** Las fechas completas que aparecieron. De aquí salen los «hace N días». */
  const fechas = new Set<string>()
  /**
   * Las cifras **tal como vinieron**, sin las variantes de escritura.
   *
   * Las cuentas se hacen solo con estas. Con las variantes dentro, de 8.42 y
   * 5.11 salían también el 8 y el 5, y de ahí un 3 por resta: «son 3 metros»
   * pasaba el filtro sin que nadie hubiera dicho 3. Los enteros de la variante
   * existen para escribir el número, no para operarlo.
   */
  const crudos = new Set<number>()

  const permitirNumero = (n: number) => {
    if (!Number.isFinite(n)) return
    crudos.add(n)
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
      for (const f of valor.match(FECHA) ?? []) fechas.add(f)
      const p = piezasDeTexto(valor)
      for (const m of p.meses) meses.add(m)
      for (const n of p.numeros) {
        numeros.add(n)
        const x = Number(n)
        if (Number.isFinite(x)) crudos.add(x)
      }
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

  return { numeros, meses, fechas, crudos: [...crudos] }
}

/**
 * Cuántos días hay entre dos fechas ISO. Negativos incluidos, en valor absoluto.
 */
function diasEntre(a: string, b: string): number | null {
  const x = Date.parse(`${a}T00:00:00Z`)
  const y = Date.parse(`${b}T00:00:00Z`)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return Math.abs(Math.round((x - y) / 86_400_000))
}

/**
 * Lo que sale de hacer cuentas con lo que el sistema dio.
 *
 * ## Por qué esto existe
 *
 * Porque la guarda estricta era **demasiado estricta y le quitaba a Bob lo que
 * lo hace útil**. «¿Hace cuántos días que no paga el 501?» no tiene herramienta
 * y no la va a tener: es una resta entre la fecha del último pago, que sí sale
 * del sistema, y hoy. Con la guarda a secas, esa respuesta correcta se
 * descartaba y el vecino recibía un «de eso no tengo dato» que era mentira.
 * Igual con «te falta S/ 84.20 para tu cuota», «el ascensor es el 13 % del
 * mes», o «gastaste el doble que el mes pasado».
 *
 * ## Qué se permite, exactamente
 *
 * Solo lo que se puede **derivar de cifras que el sistema ya dio**:
 *
 *  - sumas y restas de dos de ellas, y el valor absoluto de la resta;
 *  - el porcentaje de una sobre otra, y el múltiplo de una sobre otra;
 *  - los días entre dos fechas que aparecieron, y entre cualquiera de ellas y
 *    hoy.
 *
 * ## Qué sigue prohibido, que es lo que importa
 *
 * Una cifra que no se pueda construir así. Si Bob dice que la guardianía cuesta
 * S/ 1.800 y el sistema dijo 1.625, no hay resta ni porcentaje que lo produzca,
 * y la respuesta se descarta entera como antes. La guarda no protegía contra la
 * aritmética: protegía contra el origen desconocido, y eso no cambia.
 *
 * ## El coste
 *
 * Es cuadrático en la cantidad de cifras. Con un resultado de herramienta muy
 * grande eso se dispara, así que hay tope: pasado {@link TOPE_DERIVAR} cifras
 * no se deriva nada y se vuelve a la guarda estricta. Perder la resta es
 * molesto; quedarse sin memoria por una respuesta de chat, no.
 */
const TOPE_DERIVAR = 80

export function conCuentasSimples(
  base: { numeros: Set<string>; meses: Set<string>; fechas: Set<string>; crudos: number[] },
  hoy: Date = new Date(),
): { numeros: Set<string>; meses: Set<string>; fechas: Set<string>; crudos: number[] } {
  const numeros = new Set(base.numeros)
  const cifras = base.crudos
  if (cifras.length > TOPE_DERIVAR) return { ...base, numeros }

  /**
   * Una cifra derivada, **sin redondear al entero**.
   *
   * El entero se añadía también, y eso era un agujero de verdad: con
   * `{m3: 8.42, precioM3: 5.11}`, la resta da 3.31 y el entero 3, así que «son
   * 3 metros» pasaba el filtro. Los enteros chicos son justo los peligrosos —un
   * día del mes, una cantidad de departamentos, «3 metros»— porque hay pocos y
   * cualquier cuenta los produce. Se quedan el valor exacto y el de dos
   * decimales, que es como se escribe el dinero.
   */
  const meter = (v: number) => {
    if (!Number.isFinite(v)) return
    numeros.add(String(v))
    numeros.add(String(Math.round(v * 100) / 100))
  }

  /** Los días sí son enteros, y solo se permiten los que salen de dos fechas. */
  const meterDias = (v: number) => {
    if (Number.isFinite(v)) numeros.add(String(v))
  }

  for (let i = 0; i < cifras.length; i++) {
    for (let j = 0; j < cifras.length; j++) {
      if (i === j) continue
      const a = cifras[i]!
      const b = cifras[j]!
      meter(a + b)
      meter(a - b)
      meter(Math.abs(a - b))
      if (b !== 0) {
        meter((a / b) * 100 - 100) // «subió un 12 %»
        meter((a / b) * 100) // «es el 13 % del mes»
        meter(a / b) // «el doble», «2.5 veces»
      }
    }
  }

  // Los días entre fechas, y entre cada fecha y hoy. Es lo que hace falta para
  // «hace once días» sin que once salga de ningún sitio.
  const deHoy = hoy.toISOString().slice(0, 10)
  const todas = [...base.fechas, deHoy]
  for (const a of todas) {
    for (const b of todas) {
      if (a === b) continue
      const d = diasEntre(a, b)
      if (d !== null) meterDias(d)
    }
  }

  return { numeros, meses: base.meses, fechas: base.fechas, crudos: base.crudos }
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
  const permitido = conCuentasSimples(piezasPermitidas(llamadas))
  const dicho = piezasDeTexto(texto)
  const fuera: string[] = []
  for (const m of dicho.meses) if (!permitido.meses.has(m)) fuera.push(m)
  for (const n of dicho.numeros) if (!permitido.numeros.has(n)) fuera.push(n)
  return fuera
}
