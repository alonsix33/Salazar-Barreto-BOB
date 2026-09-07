import { publicarMes } from '@/lib/servicios/cierre'
import { zMes, zPublicar } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `POST /api/meses/[mes]/publicar` · cierre, notas y aviso a los siete. */
export async function POST(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    return publicarMes(mesId, await leerCuerpo(peticion, zPublicar))
  })
}
