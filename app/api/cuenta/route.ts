import { prisma } from '@/lib/datos/prisma'
import { responder } from '@/lib/servicios/ruta'
import { noEncontrado } from '@/lib/servicios/errores'

/** `GET /api/cuenta` · los datos de la cuenta conjunta, para la hoja de pago. */
export async function GET() {
  return responder(async () => {
    const config = await prisma.configuracionEdificio.findUnique({ where: { id: 1 } })
    if (!config) throw noEncontrado('Todavía no están configurados los datos de la cuenta.')
    return {
      cuenta: {
        banco: config.bancoNombre,
        numero: config.bancoCuenta,
        cci: config.bancoCci,
        titular: config.bancoTitular,
      },
      diaVencimiento: config.diaVencimiento,
    }
  })
}
