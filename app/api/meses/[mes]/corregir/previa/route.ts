import { corregirMes } from '@/lib/servicios/cierre'
import { zCorregirPrevia, zMes } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/**
 * `POST /api/meses/[mes]/corregir/previa` · lo que haría una corrección, sin
 * guardar nada.
 *
 * Corre el mismo `corregirMes` y deshace la transacción al final, así que las
 * cuotas que enseña son exactamente las que dejaría guardar: no hay un segundo
 * cálculo que pueda separarse del primero. No avisa a nadie ni deja rastro.
 */
export async function POST(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    const datos = await leerCuerpo(peticion, zCorregirPrevia)
    return corregirMes(mesId, { ...datos, motivo: datos.motivo ?? '' }, { simular: true })
  })
}
