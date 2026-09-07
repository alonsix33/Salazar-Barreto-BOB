import { guardarSuscripcion } from '@/lib/push'
import { dptoElegido } from '@/lib/sesion'
import { zSuscribirPush } from '@/lib/esquemas'
import { leerCuerpo, responder } from '@/lib/servicios/ruta'

/** `POST /api/push/suscribir` · un vecino activa los avisos en su dispositivo. */
export async function POST(peticion: Request) {
  return responder(async () => {
    const datos = await leerCuerpo(peticion, zSuscribirPush)
    // Si eligió departamento, se guarda con la suscripción; si no, igual sirve
    // para el aviso general de «se publicó el mes».
    const dpto = datos.dpto ?? (await dptoElegido()) ?? null
    return guardarSuscripcion({ endpoint: datos.endpoint, p256dh: datos.p256dh, auth: datos.auth, dpto })
  })
}
