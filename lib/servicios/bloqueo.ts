/**
 * Bloqueo optimista sobre el cierre de un mes.
 *
 * Dos pestañas escribiendo el mismo mes es un caso real: el administrador abre
 * el cierre en el móvil, lo sigue en la laptop, y una de las dos pierde lo que
 * escribió **en silencio**, que es lo peor que puede pasar.
 *
 * Cada escritura manda la `version` que tenía; si no coincide, se rechaza con un
 * 409 y el cliente recarga. La versión sube en cada escritura.
 */

import { conflicto } from './errores'
import type { Tx } from './auditoria'

/** Asegura que el cierre del mes existe y devuelve su fila. */
export async function cierreDe(tx: Tx, mes: string) {
  const existente = await tx.cierre.findUnique({ where: { mes } })
  if (existente) return existente
  return tx.cierre.create({ data: { mes } })
}

/**
 * Comprueba la versión y la sube.
 *
 * @param version La que el cliente tenía. Si viene `undefined` no se comprueba:
 *                es el caso de una escritura que no viene del cierre del mes.
 */
export async function tomarVersion(tx: Tx, mes: string, version?: number): Promise<number> {
  const cierre = await cierreDe(tx, mes)

  if (version === undefined) {
    const actualizado = await tx.cierre.update({
      where: { mes },
      data: { version: { increment: 1 } },
      select: { version: true },
    })
    return actualizado.version
  }

  // **La comprobación y el incremento tienen que ser una sola operación.**
  //
  // Con un `findUnique` y luego un `update`, dos transacciones simultáneas leen
  // las dos la versión 0, las dos pasan la comprobación, y las dos escriben: la
  // segunda pisa a la primera **en silencio**, que es exactamente lo que este
  // bloqueo existe para impedir. Medido: con dos escrituras a la vez, las dos
  // salían bien y quedaba solo la última.
  //
  // Un `UPDATE … WHERE version = $1` es atómico y toma el bloqueo de la fila:
  // la segunda transacción espera a que la primera confirme, vuelve a evaluar el
  // `WHERE`, ya no coincide, y afecta a cero filas.
  const actualizado = await tx.cierre.updateMany({
    where: { mes, version },
    data: { version: { increment: 1 } },
  })
  if (actualizado.count === 0) {
    const actual = await tx.cierre.findUnique({ where: { mes }, select: { version: true } })
    throw conflicto(
      'Alguien más guardó cambios en este mes mientras lo tenías abierto. Recarga para ver lo último.',
      { versionEsperada: actual?.version ?? cierre.version, versionRecibida: version },
    )
  }
  return version + 1
}

/** Rechaza si el mes ya está publicado. Para las escrituras del cierre. */
export async function exigirNoPublicado(tx: Tx, mes: string): Promise<void> {
  const cierre = await tx.cierre.findUnique({ where: { mes }, select: { publicado: true } })
  if (cierre?.publicado) {
    throw conflicto(
      'Este mes ya está publicado. Para cambiar algo hay que corregirlo, y los siete reciben el aviso.',
    )
  }
}
