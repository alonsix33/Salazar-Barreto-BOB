import { confirmarPago } from '@/lib/servicios/pagos'
import { zConfirmarPago } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder } from '@/lib/servicios/ruta'

/**
 * `POST /api/pagos/confirmar` · el administrador confirma contra el banco.
 *
 * **Requiere PIN.** Es la única acción que mueve un pago a `confirmado` y por
 * tanto la única que lo hace sumar al saldo.
 */
export async function POST(peticion: Request) {
  return responder(async () => {
    await exigirAdmin()
    return confirmarPago(await leerCuerpo(peticion, zConfirmarPago))
  })
}
