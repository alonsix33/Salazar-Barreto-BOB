import { guardarGastos } from '@/lib/servicios/cierre'
import { zGuardarGastos, zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `PUT /api/meses/[mes]/gastos` · gastos extraordinarios y créditos. */
export async function PUT(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    return guardarGastos(mesId, await leerCuerpo(peticion, zGuardarGastos))
  })
}
