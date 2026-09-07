import { corregirMes } from '@/lib/servicios/cierre'
import { zCorregir, zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `POST /api/meses/[mes]/corregir` · corregir un mes publicado. Avisa a los siete. */
export async function POST(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    return corregirMes(mesId, await leerCuerpo(peticion, zCorregir))
  })
}
