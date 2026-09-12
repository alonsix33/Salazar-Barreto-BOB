import { cookies } from 'next/headers'
import { z } from 'zod'
import { mejorarMomento } from '@/lib/bob/momento'
import { MOMENTO_IDS, type MomentoId } from '@/lib/bob/momentos'
import { zDpto, zMes } from '@/lib/esquemas/comunes'
import { COOKIE_ADMIN, sesionValida } from '@/lib/servicios/admin'
import { leerCuerpo, responder } from '@/lib/servicios/ruta'

/**
 * `POST /api/bob/momento` · la versión redactada de un texto que sale solo.
 *
 * Devuelve `{ texto: null }` cuando no hay nada mejor que lo que la pantalla ya
 * está enseñando: sin clave, con el modelo caído, o con una respuesta que no
 * pasa las guardas. **`null` no es un error**, y el cliente lo trata como
 * «déjalo como está», que es lo correcto en los cuatro casos.
 *
 * Como `/api/bob`, esta ruta **no escribe nada** salvo su registro de
 * auditoría, y `esAdmin` sale de la cookie y no del cuerpo.
 *
 * `datos` viene del cliente y eso es deliberado: es exactamente lo que la
 * pantalla ya pintó, así que el texto redactado habla de las mismas cifras que
 * el vecino tiene delante. Tomarlo de la base abriría la puerta a que Bob
 * dijera una cifra y la tabla de al lado enseñara otra. No se guarda ni decide
 * nada con ello: solo se redacta, y lo que salga se verifica contra ello mismo.
 */
const zMomento = z.object({
  // `as`: la lista es la de `MOMENTOS`, que es cerrada; Zod la quiere como tupla.
  momento: z.enum(MOMENTO_IDS as [MomentoId, ...MomentoId[]]),
  /** Lo que la pantalla ya calculó. Tope de tamaño: es un texto, no un volcado. */
  datos: z.record(z.string(), z.unknown()).refine((d) => JSON.stringify(d).length <= 4_000, {
    message: 'Demasiados datos para un texto de dos frases.',
  }),
  mes: zMes,
  dpto: zDpto.nullable().optional(),
})

export async function POST(peticion: Request) {
  return responder(async () => {
    const { momento, datos, mes, dpto } = await leerCuerpo(peticion, zMomento)
    const tarro = await cookies()
    const esAdmin = sesionValida(tarro.get(COOKIE_ADMIN)?.value)
    const texto = await mejorarMomento(momento, datos, { mes, dpto: dpto ?? null, esAdmin })
    return { texto }
  })
}
