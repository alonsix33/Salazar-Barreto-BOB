import { guardarLecturas } from '@/lib/servicios/cierre'
import { zGuardarLecturas, zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `PUT /api/meses/[mes]/lecturas` · guardar lecturas, parcial. */
export async function PUT(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    return guardarLecturas(mesId, await leerCuerpo(peticion, zGuardarLecturas))
  })
}
