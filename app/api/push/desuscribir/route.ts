import { borrarSuscripcion } from '@/lib/push'
import { zDesuscribirPush } from '@/lib/esquemas'
import { leerCuerpo, responder } from '@/lib/servicios/ruta'

/** `POST /api/push/desuscribir` · el vecino apaga los avisos en su dispositivo. */
export async function POST(peticion: Request) {
  return responder(async () => {
    const datos = await leerCuerpo(peticion, zDesuscribirPush)
    return borrarSuscripcion(datos.endpoint)
  })
}
