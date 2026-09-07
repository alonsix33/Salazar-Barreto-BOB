/**
 * Corrección de errores de tecleo en las lecturas. `01-reglas-de-negocio.md` §8.
 *
 * Genera las variantes del número tecleado a distancia 1 —transposiciones de
 * dígitos adyacentes y sustituciones de un dígito— y descarta las que no
 * cumplen las tres condiciones. **Solo propone si queda exactamente una
 * candidata válida.** Con dos o más se calla: proponer la equivocada es peor
 * que no proponer.
 *
 * Nunca corrige sola. Quien decide es el administrador, con dos botones.
 */

import { round2 } from './redondeo'
import type { Correccion } from './tipos'

/**
 * @param valorTecleado La lectura que se escribió, con sus 3 decimales.
 * @param anterior      La lectura del mes pasado del mismo medidor.
 * @param promedio      Promedio histórico de consumo de ese departamento.
 * @param objetivoM3    m³ que facturó SEDAPAL este mes.
 * @param otrosM3       Suma de los consumos de los otros seis medidores.
 * @returns La única candidata válida, o `null` si hay cero o más de una.
 */
export function proponerCorreccion(
  valorTecleado: number | string,
  anterior: number,
  promedio: number,
  objetivoM3: number,
  otrosM3: number,
): Correccion | null {
  /**
   * La forma de cadena tiene que tener **exactamente tres decimales**, que es
   * como viene una lectura del medidor.
   *
   * `String(438.03)` da `"438.03"` y al quitarle el punto quedan cinco dígitos:
   * el algoritmo mete el punto tres antes del final y sale `43.803`, diez veces
   * menos. Un `Number` de JS no conserva ceros a la derecha, así que una de cada
   * diez lecturas reales (`174.700`) llegaba deformada y la corrección quedaba
   * muerta sin que nada avisara.
   */
  const s = (typeof valorTecleado === 'number' ? valorTecleado.toFixed(3) : String(valorTecleado))
    .replace('.', '')
  const candidatas = new Set<string>()

  // Transposiciones de dígitos adyacentes
  for (let i = 0; i < s.length - 1; i++) {
    const a = s.split('')
    ;[a[i], a[i + 1]] = [a[i + 1]!, a[i]!]
    candidatas.add(a.join(''))
  }
  // Sustituciones de un dígito
  for (let i = 0; i < s.length; i++) {
    for (let d = 0; d <= 9; d++) {
      const a = s.split('')
      a[i] = String(d)
      candidatas.add(a.join(''))
    }
  }

  const validas: Correccion[] = []
  for (const c of candidatas) {
    // Se reconstruye el número metiendo el punto tres dígitos antes del final.
    // No es aritmética sobre cadenas: es cómo el original vuelve de la variante
    // de dígitos al valor decimal. `Number` de una cadena decimal no pierde
    // precisión más allá de lo que ya pierde el literal.
    const v = Number(c.slice(0, -3) + '.' + c.slice(-3))
    // El medidor no retrocede.
    if (!(v > anterior)) continue
    const cons = v - anterior
    // El consumo tiene que estar entre 0.2× y 2× el promedio del departamento.
    if (cons > promedio * 2 || cons < promedio * 0.2) continue
    // Y la suma con los otros medidores no puede pasarse de lo facturado
    // ni quedar a más de un 8% por debajo.
    const dif = objetivoM3 - (otrosM3 + cons)
    if (dif < 0 || dif > objetivoM3 * 0.08) continue
    validas.push({ valor: v, consumo: round2(cons) })
  }

  return validas.length === 1 ? validas[0]! : null
}

/**
 * Por qué la lectura que se tecleó no es válida. Códigos, no texto: la frase la
 * arma `COPYS.cierre.propuesta`, aquí solo se dice qué condición de §8 falló.
 */
export type MotivoLectura =
  | 'retrocede'
  | 'muyAlto'
  | 'muyBajo'
  | 'pasaFactura'
  | 'bajoFactura'

/** Las condiciones de §8 que **no** cumple una lectura, en el orden del documento. */
export function motivosLectura(
  valor: number,
  anterior: number,
  promedio: number,
  objetivoM3: number,
  otrosM3: number,
): MotivoLectura[] {
  const motivos: MotivoLectura[] = []
  if (!(valor > anterior)) return ['retrocede']
  const cons = valor - anterior
  if (promedio > 0) {
    if (cons > promedio * 2) motivos.push('muyAlto')
    else if (cons < promedio * 0.2) motivos.push('muyBajo')
  }
  const dif = objetivoM3 - (otrosM3 + cons)
  if (dif < 0) motivos.push('pasaFactura')
  else if (dif > objetivoM3 * 0.08) motivos.push('bajoFactura')
  return motivos
}

/** La propuesta que se le enseña al administrador, con todo lo que la frase necesita. */
export interface PropuestaLectura extends Correccion {
  dpto: string
  /** Lo que se tecleó, tal cual. */
  tecleado: number
  /** El consumo que saldría de lo tecleado. */
  consumoTecleado: number
  /** La lectura del mes pasado, para poder decirla en la frase. */
  anterior: number
  /** Cuántas veces el promedio es ese consumo, redondeado. 0 si no hay promedio. */
  veces: number
  motivos: MotivoLectura[]
}

/**
 * Revisa las siete lecturas contra el recibo y devuelve **la única** que parece
 * un error de tecleo con una única corrección posible.
 *
 * **Pide las siete lecturas y los m³ del recibo, y con menos devuelve `null`.**
 * No es cautela: es que las dos últimas condiciones de §8 comparan contra lo que
 * facturó SEDAPAL y contra la suma de los otros seis medidores. Sin recibo,
 * `objetivoM3` vale 0, `dif` sale negativo siempre y **ninguna** candidata pasa:
 * medido sobre 11.329 lecturas distintas, cero propuestas. Con las lecturas a
 * medias, `otrosM3` se queda corto y la condición del 8 % descarta todo igual.
 *
 * Por eso el paso 1 —que va antes del recibo— casi nunca propone nada, y quien
 * de verdad dispara la revisión es el paso 2, en cuanto se escriben los m³.
 * Es el primer momento del cierre en que la regla se puede evaluar.
 *
 * Si hay dos departamentos sospechosos, se calla igual que con dos candidatas:
 * enseñar una propuesta cuando hay otra igual de probable dirige la vista al
 * sitio equivocado.
 */
export function revisarLecturas(
  lecturas: Readonly<Record<string, number>>,
  anteriores: Readonly<Record<string, number>>,
  promedios: Readonly<Record<string, number>>,
  objetivoM3: number,
  dptos: readonly string[],
): PropuestaLectura | null {
  if (!(objetivoM3 > 0)) return null
  if (dptos.some((id) => lecturas[id] === undefined || anteriores[id] === undefined)) return null

  const consumo = (id: string) => round2(lecturas[id]! - anteriores[id]!)
  const encontradas: PropuestaLectura[] = []

  for (const id of dptos) {
    const tecleado = lecturas[id]!
    const anterior = anteriores[id]!
    const promedio = promedios[id] ?? 0
    const otros = round2(
      dptos.filter((o) => o !== id).reduce((s, o) => s + consumo(o), 0),
    )
    const candidata = proponerCorreccion(tecleado, anterior, promedio, objetivoM3, otros)
    if (!candidata || candidata.valor === tecleado) continue
    const consTecleado = round2(tecleado - anterior)
    encontradas.push({
      ...candidata,
      dpto: id,
      tecleado,
      anterior,
      consumoTecleado: consTecleado,
      /**
       * Al más cercano, porque **así lo escribe el diseño**.
       *
       * `04` enseña la frase con 62.40 m³ sobre un promedio de 17 —3.67 veces— y
       * la llama *«cuatro veces tu promedio»*. Redondear hacia abajo daría
       * «tres» y rompería el copy literal.
       *
       * El caso incómodo que eso deja —2.4 veces anunciado como «el doble»— se
       * resuelve en el texto y no en la aritmética: `VECES[2]` dice «más del
       * doble», que es cierto por construcción, porque `muyAlto` exige que el
       * consumo pase estrictamente del doble del promedio.
       */
      veces: promedio > 0 ? Math.round(consTecleado / promedio) : 0,
      motivos: motivosLectura(tecleado, anterior, promedio, objetivoM3, otros),
    })
  }

  return encontradas.length === 1 ? encontradas[0]! : null
}
