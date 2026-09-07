/**
 * La cara de Bob. **No se toca.**
 *
 * Bob es un blobatar: una forma generada a partir de un nombre semilla más una
 * lista de rasgos fijados a mano. La combinación de esta semilla y estos rasgos
 * **es** su cara. Cambiar cualquiera de los dos —incluida la semilla, que es la
 * que decide todos los rasgos que aquí no se fijan— produce otra cara distinta.
 * Por eso viven en un solo sitio, con nombre propio y este aviso.
 *
 * ## Por qué los colores están aquí en hexadecimal
 *
 * `lib/tema.ts` es la otra excepción a «cero valores huérfanos», y por la misma
 * razón: el generador recibe los colores como cadenas en el momento de pintar,
 * así que no puede leer una variable CSS —el SVG se genera en el servidor, donde
 * no hay hoja de estilos—. La opción `palette` del paquete es la vía soportada
 * para esto y **no toca ningún rasgo**: la construcción del blob queda idéntica
 * y solo cambia el color final.
 *
 * Lo que convierte esta excepción en algo seguro es `__tests__/bob-cara.test.ts`,
 * que comprueba que cada color de aquí sale, letra por letra, del token de
 * `app/globals.css`. Si alguien cambia el token y no este fichero, el test se
 * pone rojo. Sin ese candado, esto serían dos verdades sin enganchar.
 *
 * ## Por qué el ámbar del token y no el que emite el generador
 *
 * El rasgo `hue: 0.176` hace que el generador emita `#c07000` por su cuenta, que
 * está a un pelo de nuestro ámbar (`#c07a1a`). Se fija el nuestro para que en
 * todo el producto haya **un solo ámbar**: el de Bob y el de los avisos son el
 * mismo color, no dos que se parecen.
 */

import type { BlobatarProps } from '@blobatar/react'

/**
 * La semilla. Con los rasgos de abajo, esto es Bob.
 *
 * Los rasgos fijados no son todos los que tiene un blobatar: los que faltan los
 * decide el hash de esta cadena. Cambiarla mueve la cara aunque los rasgos se
 * queden igual.
 */
export const SEMILLA = 'elin'

/** Los rasgos fijados de Bob, tal como llegaron. */
export const RASGOS: NonNullable<BlobatarProps['traits']> = {
  shape: 0.745,
  'body.ratio': 0.152,
  'eye.rx': 0.999,
  'eye.ratio': 0.723,
  hue: 0.176,
  'nub.r0': 0.74,
}

/**
 * Ámbar de `--color-ambar`. El cuerpo de Bob.
 *
 * Es el mismo ámbar de los avisos: en todo el producto hay **un solo** ámbar.
 */
export const AMBAR = '#c07a1a'

/**
 * Crema de `--color-crema`. Los ojos de Bob.
 *
 * Crema y no tinta porque es lo que dice `02` §5, y es lo que el avatar ha sido
 * desde el primer día: cuerpo ámbar con los ojos del color del fondo. El
 * generador emitiría ojos casi negros por su cuenta; se fija este para no
 * cambiarle la identidad a Bob de paso.
 */
export const CREMA = '#f7f4ee'

/**
 * De qué token de `app/globals.css` sale cada color de aquí.
 *
 * Es lo que hace comprobable la excepción: `__tests__/bob-cara.test.ts` exige
 * que **cada** constante de color tenga su entrada aquí y que el valor coincida
 * letra por letra con el token. Un color nuevo sin origen pone el test en rojo,
 * que es justo lo que tiene que pasar.
 */
export const ORIGEN_TOKENS = {
  AMBAR: '--color-ambar',
  CREMA: '--color-crema',
} as const
