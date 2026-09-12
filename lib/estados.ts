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

export type EstadoCuota = 'al-dia' | 'sin-cobro' | 'sin-registrar' | 'en-verificacion'

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
 */
export function estadoCuota(
  pago: { estado: EstadoPago } | null | undefined,
  cuota?: number,
): EstadoCuota {
  if (pago) return pago.estado === 'confirmado' ? 'al-dia' : 'en-verificacion'
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
  pago: { estado: EstadoPago } | null | undefined,
  cuota: number,
): boolean {
  return estadoCuota(pago, cuota) === 'al-dia' || estadoCuota(pago, cuota) === 'sin-cobro'
}

/** Solo los confirmados suman al saldo de la cuenta. `01` §6. */
export function sumaAlSaldo(pago: { estado: EstadoPago } | null | undefined): boolean {
  return pago?.estado === 'confirmado'
}
