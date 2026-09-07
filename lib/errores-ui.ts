/**
 * El mensaje de un error que llega del servidor, para enseñárselo a alguien.
 *
 * Existe para quitar de en medio el `(error as Error).message` que estaba
 * repetido en diez sitios. No es solo estética: **si lo que se lanza no es un
 * `Error`, esa aserción no falla, devuelve `undefined`**, y el aviso en pantalla
 * sale vacío. Un `throw 'algo'` dentro de un `mutationFn`, o un rechazo con un
 * objeto plano, dejaban al vecino mirando un recuadro ámbar sin texto.
 *
 * Aquí se mira de verdad qué llegó, y si no hay nada legible se dice algo.
 */
export function mensajeDeError(error: unknown, porDefecto = 'No se pudo completar la acción.'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return porDefecto
}
