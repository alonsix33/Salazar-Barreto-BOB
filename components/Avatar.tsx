/**
 * El avatar de Bob. `02` §5.
 *
 * Una forma redondeada con hue ámbar y dos ojos. **Nunca** una chispa, ni un
 * gradiente morado, ni una cara con expresión de juicio. Bob no finge ser una
 * persona.
 *
 * ## Un solo sitio para toda la cara de Bob
 *
 * Este componente es la única costura: Bob aparece en la línea de Inicio, en la
 * cabecera y las burbujas de su hoja, en los avisos del cierre y en el botón de
 * la navegación, y **todos** pasan por aquí. Cambiar la cara es cambiar este
 * fichero, no cazar apariciones sueltas.
 *
 * La forma la genera `blobatar` a partir de la semilla y los rasgos de
 * `lib/bob-cara.ts`, que no se tocan. Los colores entran por `palette`, que es
 * la vía que el paquete ofrece para eso y **no mueve la construcción del blob**.
 *
 * ## La animación
 *
 * `animate="always"` porque en un teléfono no hay `:hover`: sin `always` el
 * paquete deja las animaciones pausadas en pantallas táctiles, y Bob se quedaría
 * quieto justo donde vive la app. Respira, cabecea, parpadea y mira alrededor.
 *
 * Nada de esto finge que piensa: no hay puntos en bucle ni texto letra por
 * letra, que es lo que `05` §6 prohíbe. Es un gesto de vida, no un indicador de
 * proceso. Y el propio `motion.css` apaga todo con `prefers-reduced-motion`, así
 * que quien pida menos movimiento ve a Bob quieto.
 */

import { Blobatar } from '@blobatar/react'
import { happy, idle } from 'blobatar/expression'
import { AMBAR, CREMA, RASGOS, SEMILLA } from '@/lib/bob-cara'

const TAMANOS = {
  linea: 20,
  tarjeta: 24,
  aviso: 22,
  nav: 38,
  cabecera: 30,
} as const

export function Avatar({
  tamano = 'tarjeta',
  invertido = false,
  sonrie = false,
}: {
  tamano?: keyof typeof TAMANOS
  /** Relleno crema sobre fondo ámbar, para el botón de la navegación. */
  invertido?: boolean
  sonrie?: boolean
}) {
  const px = TAMANOS[tamano]
  return (
    <Blobatar
      name={SEMILLA}
      traits={RASGOS}
      size={px}
      animate="always"
      expression={sonrie ? happy : idle}
      // El fondo lo pone la app: el botón de la navegación trae su círculo
      // ámbar y las burbujas su tarjeta. Aquí, transparente.
      background={false}
      // Invertido solo intercambia los dos colores: es el botón de la
      // navegación, Bob en crema sobre su círculo ámbar.
      palette={{
        head: invertido ? CREMA : AMBAR,
        eye: invertido ? AMBAR : CREMA,
      }}
      className={invertido ? 'avatar-invertido' : 'avatar'}
    />
  )
}
