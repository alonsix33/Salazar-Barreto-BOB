import { guardarReasignacion } from '@/lib/servicios/cierre'
import { zGuardarReasignaciones, zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `PUT /api/meses/[mes]/reasignaciones` · activar o desactivar el lavado. */
export async function PUT(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    const datos = await leerCuerpo(peticion, zGuardarReasignaciones)
    return guardarReasignacion(mesId, datos.activa, datos.version)
  })
}
