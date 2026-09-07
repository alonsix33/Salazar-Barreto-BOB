import { marcarLeidos } from '@/lib/datos/avisos'
import { zMarcarLeidos } from '@/lib/esquemas'
import { leerCuerpo, responder } from '@/lib/servicios/ruta'

/** `POST /api/avisos/leer` · marcar como leídos. Apaga el punto de la campana. */
export async function POST(peticion: Request) {
  return responder(async () => {
    const datos = await leerCuerpo(peticion, zMarcarLeidos)
    return marcarLeidos(datos.dpto, datos.avisos)
  })
}
