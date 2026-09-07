import type { ReactNode } from 'react'

/**
 * El botón principal: noche, 54px, radio 999. `04-cierre-del-mes.md`.
 *
 * Cuando no se puede avanzar **el botón dice qué falta**, no se pone gris sin
 * explicación: por eso `motivoBloqueo` no es opcional cuando `deshabilitado`
 * está puesto — el tipo lo obliga.
 */

type Base = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  /** `noche` es el principal; `terra` el de acción dentro de la tarjeta noche. */
  tono?: 'noche' | 'terra'
  ancho?: 'completo' | 'auto'
}

type Props =
  | (Base & { deshabilitado?: false; motivoBloqueo?: never })
  | (Base & { deshabilitado: true; motivoBloqueo: string })

const TONO = {
  noche: 'bg-noche text-sobre-noche',
  terra: 'bg-terra text-papel',
} as const

export function Boton({
  children,
  onClick,
  type = 'button',
  className = '',
  tono = 'noche',
  ancho = 'completo',
  deshabilitado = false,
  motivoBloqueo,
}: Props) {
  return (
    <button
      type={type}
      onClick={deshabilitado ? undefined : onClick}
      aria-disabled={deshabilitado || undefined}
      className={`tipo-cuerpo-destacado flex h-boton items-center justify-center rounded-pildora ${
        ancho === 'completo' ? 'w-full' : 'px-boton-x'
      } ${deshabilitado ? 'bg-apagado text-papel' : TONO[tono]} ${className}`}
    >
      {deshabilitado ? motivoBloqueo : children}
    </button>
  )
}
