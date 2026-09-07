import { z } from 'zod'
import { excelDelAnio } from '@/lib/servicios/excel'
import { ErrorDeApi } from '@/lib/servicios/errores'
import { validarParametro } from '@/lib/servicios/ruta'

/**
 * `GET /api/export/[anio]` · el Excel del año.
 *
 * Devuelve el archivo de verdad, con `Content-Disposition`, para que el
 * navegador lo descargue. No requiere PIN: los datos son públicos entre los
 * siete por diseño.
 */
export async function GET(_: Request, ctx: { params: Promise<{ anio: string }> }) {
  try {
    const { anio } = await ctx.params
    const n = validarParametro(
      Number(anio),
      z.number().int().min(2000).max(2100),
      'año',
    )
    const excel = await excelDelAnio(n)
    return new Response(new Uint8Array(excel), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="edificio-salazar-barreto-${n}.xlsx"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    if (e instanceof ErrorDeApi) {
      return Response.json({ error: e.message }, { status: e.estado })
    }
    console.error('[api/export]', e)
    return Response.json({ error: 'No se pudo generar el Excel.' }, { status: 500 })
  }
}
