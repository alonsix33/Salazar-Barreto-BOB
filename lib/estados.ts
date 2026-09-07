/**
 * Los estados de un pago vistos desde la interfaz. `01-reglas-de-negocio.md` §7.
 *
 * En el dominio hay `'confirmado' | 'aviso' | null`; en pantalla hay tres
 * nombres, y son los que el usuario lee. La traducción vive aquí y en un solo
 * sitio, para que nadie escriba "pendiente" en una pantalla y "sin registrar"
 * en otra.
 */

import type { EstadoPago } from './calculo/tipos'

export type EstadoCuota = 'al-dia' | 'sin-registrar' | 'en-verificacion'

/** El estado guardado, traducido al que se muestra. */
export function estadoCuota(pago: { estado: EstadoPago } | null | undefined): EstadoCuota {
  if (!pago) return 'sin-registrar'
  return pago.estado === 'confirmado' ? 'al-dia' : 'en-verificacion'
}

/** Solo los confirmados suman al saldo de la cuenta. `01` §6. */
export function sumaAlSaldo(pago: { estado: EstadoPago } | null | undefined): boolean {
  return pago?.estado === 'confirmado'
}
