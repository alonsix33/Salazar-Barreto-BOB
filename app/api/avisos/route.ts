import { avisosPara } from '@/lib/datos/avisos'
import { zDpto } from '@/lib/esquemas'
import { responder, validarParametro } from '@/lib/servicios/ruta'

/** `GET /api/avisos?dpto=401` · la lista, con leído/no leído. */
export async function GET(peticion: Request) {
  return responder(async () => {
    const dpto = new URL(peticion.url).searchParams.get('dpto')
    return { avisos: await avisosPara(validarParametro(dpto, zDpto, 'dpto')) }
  })
}
