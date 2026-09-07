import { historialDeDpto } from '@/lib/datos/historial'
import { zDpto } from '@/lib/esquemas'
import { responder, validarParametro } from '@/lib/servicios/ruta'

/** `GET /api/dptos/[id]/historial` · pagos y consumo, 12 meses. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const { id } = await ctx.params
    return historialDeDpto(validarParametro(id, zDpto, 'departamento'))
  })
}
