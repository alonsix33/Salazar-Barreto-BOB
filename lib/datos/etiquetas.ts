/**
 * La etiqueta de caché del edificio y el contador de escrituras.
 *
 * Vive en su propio módulo, sin importar nada, porque lo usan a la vez
 * `prisma.ts` (que avisa cuando algo cambia) y `almanaque.ts` (que cachea con
 * esa etiqueta). Si la constante viviera en cualquiera de los dos, el otro
 * cerraría un ciclo de importaciones.
 */

/** Todo lo que se lee del edificio cuelga de esta etiqueta. Una sola. */
export const TAG_EDIFICIO = 'edificio'

/**
 * Cuántas escrituras han pasado por Prisma desde que arrancó el proceso.
 *
 * No pretende ser exacto entre peticiones concurrentes: solo sirve para que
 * `responder()` sepa si *algo* se escribió mientras atendía esta petición y
 * vuelva a invalidar después del commit. Contar de más invalida de más, que es
 * el lado seguro; contar de menos no puede pasar porque solo sube.
 */
let escrituras = 0

export function contarEscritura(): void {
  escrituras++
}

export function selloDeEscrituras(): number {
  return escrituras
}
