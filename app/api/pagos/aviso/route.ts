import { avisarPago } from '@/lib/servicios/pagos'
import { zAvisoPago } from '@/lib/esquemas'
import { leerCuerpo, responder } from '@/lib/servicios/ruta'

/**
 * `POST /api/pagos/aviso` · el vecino dice "ya pagué".
 *
 * No requiere PIN: es el propio vecino. **No suma al saldo**: pasa a
 * `en verificación` y quien administra lo confirma contra el estado de cuenta.
 */
export async function POST(peticion: Request) {
  return responder(async () => avisarPago(await leerCuerpo(peticion, zAvisoPago)))
}
