import { z } from 'zod'
import { guardarPaso } from '@/lib/servicios/cierre'
import { zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

const zPaso = z.object({ paso: z.number().int().min(0).max(7) })

/**
 * `PUT /api/meses/[mes]/paso` · en qué paso se quedó el administrador.
 *
 * Va en el servidor y no en el navegador porque **el admin puede cambiar de
 * teléfono**: `04` §2 pide que se pueda salir y volver sin perder nada, y eso
 * incluye volver desde otro aparato.
 */
export async function PUT(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    const { paso } = await leerCuerpo(peticion, zPaso)
    return guardarPaso(mesId, paso)
  })
}
