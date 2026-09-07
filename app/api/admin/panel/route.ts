import { panelDeAdmin } from '@/lib/datos/admin'
import { exigirAdmin, responder } from '@/lib/servicios/ruta'

/** `GET /api/admin/panel` · lo que el panel y sus hojas necesitan. Requiere PIN. */
export async function GET() {
  return responder(async () => {
    await exigirAdmin()
    return panelDeAdmin()
  })
}
