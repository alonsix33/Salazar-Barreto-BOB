import { datosDeCorreccion } from '@/lib/datos/meses'
import { zMes } from '@/lib/esquemas'
import { exigirAdmin, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/**
 * `GET /api/meses/[mes]/correccion` · el mes publicado tal como está hoy, con
 * todo lo que se puede corregir. Lo lee la hoja de corregir; pide PIN porque
 * trae los pagos y la versión del bloqueo.
 */
export async function GET(_: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    return datosDeCorreccion(validarParametro(mes, zMes, 'mes') as MesId)
  })
}
