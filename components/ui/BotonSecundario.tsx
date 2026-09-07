import type { ReactNode } from 'react'

/**
 * El botón de segunda acción. Sobre fondo noche va translúcido; sobre crema, en
 * neutro suave. Nunca lleva color con significado: el color lo carga el estado.
 */
export function BotonSecundario({
  children,
  onClick,
  sobreNoche = false,
  ancho = 'completo',
  className = '',
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  sobreNoche?: boolean
  ancho?: 'completo' | 'auto'
  className?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`tipo-cuerpo-enlace flex h-toque items-center justify-center rounded-pildora ${
        ancho === 'completo' ? 'flex-1' : 'px-boton-x'
      } ${
        sobreNoche
          ? 'bg-sobre-noche-boton text-sobre-noche'
          : 'bg-neutro-suave text-tinta'
      } ${className}`}
    >
      {children}
    </button>
  )
}
