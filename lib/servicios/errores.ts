/**
 * Los errores del backend, con su código HTTP.
 *
 * Cada uno tiene que devolver un mensaje claro y su código. **Nunca un 500 ni un
 * registro corrupto en la base**: un 500 es un bug que se nos escapó, no una
 * forma de contestar.
 *
 * Los mensajes los lee el administrador desde el móvil, así que están en el
 * idioma del vecino, no en el del programador.
 */

export class ErrorDeApi extends Error {
  constructor(
    readonly estado: number,
    override readonly message: string,
    readonly detalle?: unknown,
  ) {
    super(message)
    this.name = 'ErrorDeApi'
  }
}

export const noEncontrado = (que: string) => new ErrorDeApi(404, que)
export const peticionMala = (porQue: string, detalle?: unknown) => new ErrorDeApi(400, porQue, detalle)
export const conflicto = (porQue: string, detalle?: unknown) => new ErrorDeApi(409, porQue, detalle)
export const sinPermiso = (porQue = 'Hace falta el PIN de administración.') => new ErrorDeApi(401, porQue)
export const demasiadosIntentos = (porQue: string) => new ErrorDeApi(429, porQue)
