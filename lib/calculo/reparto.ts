/**
 * Cómo se reparte un gasto puntual entre los departamentos que lo pagan.
 *
 * El mantenimiento normal se reparte siempre por flat entre los siete. Pero un
 * gasto puntual no siempre lo pagan todos: el portón del garaje no le sirve al
 * primer piso, así que el 101 no entra. Y entonces hay que decidir cómo se
 * reparte entre los seis que quedan.
 *
 * **La regla es renormalizar, no dividir en partes iguales.** Los seis que
 * pagan suman 88.28 % del edificio; ese 88.28 pasa a ser el nuevo 100 % y cada
 * uno paga su parte proporcional dentro de él. Así se respeta que el 502 es más
 * grande que el 201, que es justo lo que el flat significa.
 *
 * `iguales` existe solo para el histórico: la planilla repartió así algunos
 * gastos (el tanque hidroneumático a S/ 182.90 cada uno) y esos meses se
 * cargan tal como se cobraron. De aquí en adelante, porcentaje.
 *
 * ## Por qué la asignación de céntimos es lo delicado
 *
 * Repartir S/ 300 entre seis por porcentaje da decimales infinitos. Si cada
 * parte se redondea por su cuenta, la suma puede quedar en 299.99 o en 300.01
 * —y entonces el mes **no cuadra**, que es lo peor que puede pasar—. Aquí se
 * reparte por el método del resto mayor: se trunca a céntimo, se cuenta cuántos
 * céntimos faltan, y esos se dan de a uno a quien tenga el resto más grande.
 * La suma es exacta por construcción, no por suerte.
 */

import type { DptoId } from './tipos'
import { DPTOS } from './constantes'

/** Cómo se divide el gasto entre los que sí lo pagan. */
export type ModoReparto = 'porcentaje' | 'iguales'

/**
 * Reparte `monto` entre `participantes`.
 *
 * Devuelve cuánto le toca a cada uno. **La suma es exactamente `monto`**, al
 * céntimo. Un departamento que no participa no aparece en el resultado.
 *
 * @param participantes Los que pagan. Vacío o sin especificar significa **los
 *                      siete**, que es el caso normal.
 */
export function repartir(
  monto: number,
  participantes: readonly DptoId[] | undefined,
  modo: ModoReparto = 'porcentaje',
): Partial<Record<DptoId, number>> {
  const quienes =
    participantes && participantes.length > 0
      ? DPTOS.filter((d) => participantes.includes(d.id))
      : DPTOS.slice()

  const salida: Partial<Record<DptoId, number>> = {}
  if (quienes.length === 0 || !Number.isFinite(monto) || monto === 0) return salida

  // El peso de cada uno: su flat, o 1 si se reparte en partes iguales.
  const pesos = quienes.map((d) => (modo === 'iguales' ? 1 : d.flat))
  const suma = pesos.reduce((s, p) => s + p, 0)
  if (suma <= 0) return salida

  /**
   * Todo en céntimos enteros. Trabajar en soles con decimales es lo que hace
   * que 0.1 + 0.2 no sea 0.3 y que la suma final baile.
   */
  const totalCent = Math.round(monto * 100)
  const exactos = pesos.map((p) => (totalCent * p) / suma)
  const truncados = exactos.map((e) => Math.floor(e))
  const faltan = totalCent - truncados.reduce((s, t) => s + t, 0)

  // Los céntimos que faltan van a los restos más grandes. Con empate, al que
  // tiene más flat: es arbitrario, pero tiene que ser **estable**, o el mismo
  // mes daría dos repartos distintos en dos cálculos.
  const orden = exactos
    .map((e, i) => ({ i, resto: e - Math.floor(e), peso: pesos[i]! }))
    .sort((a, b) => b.resto - a.resto || b.peso - a.peso || a.i - b.i)
  for (let k = 0; k < faltan; k++) {
    const fila = orden[k % orden.length]
    if (fila) truncados[fila.i] = truncados[fila.i]! + 1
  }

  quienes.forEach((d, i) => {
    salida[d.id] = truncados[i]! / 100
  })
  return salida
}
