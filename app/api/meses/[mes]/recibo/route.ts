import { guardarRecibo } from '@/lib/servicios/cierre'
import { zGuardarRecibo, zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `PUT /api/meses/[mes]/recibo` · guardar el recibo, parcial. */
export async function PUT(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    return guardarRecibo(mesId, await leerCuerpo(peticion, zGuardarRecibo))
  })
}
