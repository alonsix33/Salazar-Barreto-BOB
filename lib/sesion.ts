/** Leer, en el servidor, el departamento elegido. */

import { cookies } from 'next/headers'
import { COOKIE_DPTO } from './dispositivo'
import { zDpto } from './esquemas'
import type { DptoId } from './calculo/tipos'

/** El departamento elegido, o `null` si todavía no eligió ninguno. */
export async function dptoElegido(): Promise<DptoId | null> {
  const tarro = await cookies()
  const r = zDpto.safeParse(tarro.get(COOKIE_DPTO)?.value)
  return r.success ? r.data : null
}
