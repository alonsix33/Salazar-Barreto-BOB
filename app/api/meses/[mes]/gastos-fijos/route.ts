import { z } from 'zod'
import { guardarGastosFijos } from '@/lib/servicios/gastosFijos'
import { zMes, zMonto, zTexto, zVersion } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

const zUno = z.object({
  concepto: zTexto(80).min(1),
  monto: zMonto.nullable(),
  /** Anual se divide entre 12. Se manda solo al crear o cambiar la marca. */
  anual: z.boolean().optional(),
  /**
   * El bloqueo optimista, que este esquema **no declaraba**.
   *
   * El asistente sí mandaba `version` en el cuerpo; Zod la tiraba al vuelo por
   * no estar declarada, y la escritura se colaba sin comprobar nada. Dos
   * pestañas editando el mismo gasto: la segunda pisaba a la primera y la
   * primera no se enteraba.
   */
  version: zVersion,
})

/**
 * `PUT /api/meses/[mes]/gastos-fijos` · editar un concepto desde el paso 4.
 *
 * Aplica **desde ese mes**, no reescribe el pasado: subir el ascensor en agosto
 * no puede cambiar las cuotas de enero, que ya se cobraron. Y tampoco el propio
 * mes si ya está publicado: eso lo frena `exigirNoPublicado` en el servicio.
 *
 * No avisa a los siete. Es una tecla del cierre —el numpad del paso 4—, y nada
 * de los pasos 1 a 6 se les cuenta a los vecinos: el mes todavía no existe para
 * ellos. Cada tanteo del monto de la guardianía mandaba un aviso a siete
 * personas.
 */
export async function PUT(peticion: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    await exigirAdmin()
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    const cambio = await leerCuerpo(peticion, zUno)
    return guardarGastosFijos(
      {
        cambios: [{ concepto: cambio.concepto, monto: cambio.monto, anual: cambio.anual }],
        vigenteDesde: mesId,
      },
      true,
      cambio.version,
    )
  })
}
