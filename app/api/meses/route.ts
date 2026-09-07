import { listaDeMeses } from '@/lib/datos/meses'
import { responder } from '@/lib/servicios/ruta'

/** `GET /api/meses` · la lista de meses con su estado. */
export async function GET() {
  return responder(async () => ({ meses: await listaDeMeses() }))
}
