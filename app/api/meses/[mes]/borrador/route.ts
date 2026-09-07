import { borradorDeMes } from '@/lib/datos/meses'
import { zMes } from '@/lib/esquemas'
import { exigirAdmin, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/**
 * `GET /api/meses/[mes]/borrador` · el mes en curso tal como va.
 *
 * Trae lo guardado, el paso en el que se quedó el administrador y la versión
 * para el bloqueo optimista. Es lo que hace que se pueda salir y volver, y
 * desde otro teléfono.
 */
export async function GET(_: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    return borradorDeMes(validarParametro(mes, zMes, 'mes') as MesId)
  })
}
