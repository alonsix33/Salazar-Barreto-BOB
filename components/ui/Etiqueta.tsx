import type { ReactNode } from 'react'

/**
 * La etiqueta mono en mayúsculas de 10px con `letter-spacing: .16em`.
 *
 * `02-sistema-de-diseno.md` §2: **es el sello visual de la app**. Encabeza casi
 * todas las secciones. Es un componente y no una clase que haya que recordar,
 * precisamente para que nadie la sustituya por un `<h3>` normal.
 */

export type TonoEtiqueta =
  | 'gris'
  | 'terra'
  | 'agua'
  | 'sobre-noche'

const TONO: Record<TonoEtiqueta, string> = {
  gris: 'text-gris',
  terra: 'text-terra-oscuro',
  agua: 'text-agua',
  'sobre-noche': 'text-sobre-noche-etiqueta',
}

export function Etiqueta({
  children,
  tono = 'gris',
  tamano = 'seccion',
  className = '',
  id,
}: {
  children: ReactNode
  tono?: TonoEtiqueta
  /** `seccion` es la de 10px; `pequena` la de 9px que llevan las tarjetas chicas. */
  tamano?: 'seccion' | 'pequena'
  className?: string
  id?: string
}) {
  const tipo = tamano === 'seccion' ? 'tipo-etiqueta-seccion' : 'tipo-etiqueta-pequena'
  return (
    <span id={id} className={`${tipo} ${TONO[tono]} ${className}`}>
      {children}
    </span>
  )
}
