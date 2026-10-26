/**
 * Los estados de un pago vistos desde la interfaz. `01-reglas-de-negocio.md` §7.
 *
 * En el dominio hay `'confirmado' | 'aviso' | null`; en pantalla hay cuatro
 * nombres, y son los que el usuario lee. La traducción vive aquí y en un solo
 * sitio, para que nadie escriba "pendiente" en una pantalla y "sin registrar"
 * en otra.
 */

import { round2 } from './calculo/redondeo'
import type { EstadoPago } from './calculo/tipos'

export type EstadoCuota = 'al-dia' | 'sin-cobro' | 'sin-registrar' | 'en-verificacion' | 'falta-parte'

/**
 * El estado guardado, traducido al que se muestra.
 *
 * `cuota` es el total del mes para ese departamento, y decide el caso en que no
 * hay pago registrado: **cero no es lo mismo que falta**. Al 501 se le condonó
 * lo de junio y julio, así que su cuota de esos meses es S/ 0.00; sin este
 * parámetro la píldora decía «Sin registrar» al lado de un cero, que es
 * exactamente lo que no queríamos —el departamento que no debe nada figurando
 * como el único que arrastra—. Pasa igual con quien paga por adelantado y su
 * crédito le cubre el mes entero.
 *
 * Si hay pago, manda el pago: alguien puede depositar igual un mes en cero y
 * eso hay que verlo.
 *
 * **Confirmado no es lo mismo que completo.** Si el pago confirmado tiene un
 * monto anotado y es menor que la cuota, el estado es `falta-parte`, no
 * `al-dia`. Pasa cuando alguien depositó de menos, y sobre todo cuando se
 * corrige un mes ya pagado: pagó 600, ahora la cuota es 800, debe 200. Con
 * «Al día» la pantalla decía una cosa y el balance, tres líneas más abajo, la
 * contraria. Pagar de más sigue siendo «al día»: lo que sobra queda a favor.
 */
export function estadoCuota(
  pago: { estado: EstadoPago; monto?: number | null } | null | undefined,
  cuota?: number,
): EstadoCuota {
  if (pago) {
    if (pago.estado !== 'confirmado') return 'en-verificacion'
    const puso = pago.monto ?? null
    return puso !== null && cuota !== undefined && round2(puso) < round2(cuota) ? 'falta-parte' : 'al-dia'
  }
  return cuota !== undefined && round2(cuota) <= 0 ? 'sin-cobro' : 'sin-registrar'
}

/**
 * ¿Este departamento tiene el mes resuelto?
 *
 * Verdadero si pagó y está confirmado, o si no había nada que pagar. Es lo que
 * cuenta el «N de 7 al día»: con la condonación del 501, contar solo pagos
 * confirmados dejaba junio en «6 de 7» sin que nadie debiera un sol.
 */
export function nadaPendiente(
  pago: { estado: EstadoPago; monto?: number | null } | null | undefined,
  cuota: number,
): boolean {
  return estadoCuota(pago, cuota) === 'al-dia' || estadoCuota(pago, cuota) === 'sin-cobro'
}

/** Solo los confirmados suman al saldo de la cuenta. `01` §6. */
export function sumaAlSaldo(pago: { estado: EstadoPago } | null | undefined): boolean {
  return pago?.estado === 'confirmado'
}

/**
 * Lo que un departamento puso en un mes y si lo dejó completo. **Una sola
 * copia**: el historial de doce meses y la tira del año la usaban cada una por
 * su lado, y las dos sumaban la cuota entera de todo pago confirmado.
 *
 * Eso mentía en cuanto el monto anotado era menor que la cuota —y es lo que
 * pasa cuando se corrige un mes ya pagado—: medido, el «pagado en 2026» del 101
 * subió S/ 35.63 tras una corrección sin que depositara nada. Lo pagado es lo
 * que entró, no la cuota.
 */
export function aporteDeFila(
  f: { estado: EstadoPago | null; cuota: number | null; monto: number | null },
): { puso: number; completo: boolean } | null {
  if (f.estado !== 'confirmado') return null
  const puso = f.monto ?? f.cuota ?? 0
  return { puso, completo: f.cuota === null || round2(puso) >= round2(f.cuota) }
}

/**
 * Lo que le falta poner a un departamento de **este** mes: la cuota menos lo que
 * entró, solo si el pago está confirmado y entró menos. 0 en cualquier otro caso
 * —sin pago, avisado, justo o de más—: ahí no es «falta una parte», es otro
 * estado. La usan el panel de administración y la hoja de pagos de un mes
 * anterior, que armaban cada una su fila por su lado.
 */
export function faltaDelMes(
  pago: { estado: EstadoPago; monto?: number | null } | null | undefined,
  cuota: number | null,
): number {
  if (!pago || cuota === null || estadoCuota(pago, cuota) !== 'falta-parte') return 0
  return round2(cuota - (pago.monto ?? 0))
}
