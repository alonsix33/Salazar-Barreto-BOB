import { resultadoDeMes } from '@/lib/datos/mes'
import { pagosDe } from '@/lib/datos/mes'
import { prisma } from '@/lib/datos/prisma'
import { zMes } from '@/lib/esquemas'
import { responder, validarParametro } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/**
 * `GET /api/meses/[mes]` · el `ResultadoMes` calculado, con sus pagos.
 *
 * Lleva también `version`, la del bloqueo optimista: la hoja de corregir la
 * necesita para mandarla de vuelta, y sin ella dos correcciones simultáneas del
 * mismo mes salían las dos bien y los dos avisos citaban el mismo «pasó de S/ …».
 * Es un entero sin significado fuera de aquí; no expone nada.
 */
export async function GET(_: Request, ctx: { params: Promise<{ mes: string }> }) {
  return responder(async () => {
    const { mes } = await ctx.params
    const mesId = validarParametro(mes, zMes, 'mes') as MesId
    const [resultado, pagos, cierre] = await Promise.all([
      resultadoDeMes(mesId),
      pagosDe(mesId),
      prisma.cierre.findUnique({ where: { mes: mesId }, select: { version: true } }),
    ])
    return { resultado, pagos, version: cierre?.version ?? 0 }
  })
}
