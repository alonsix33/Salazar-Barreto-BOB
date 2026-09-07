import type { ReactNode } from 'react'

/**
 * Tarjeta blanca. `02` §3.
 *
 * Se reserva para bloques que son **una unidad conceptual**. Una lista de siete
 * departamentos son siete filas separadas por líneas finas, no siete tarjetas:
 * para eso está `FilaDivisoria`.
 */
export function TarjetaBlanca({
  children,
  tamano = 'grande',
  className = '',
  ...resto
}: {
  children: ReactNode
  /** `grande` es radio 22, `media` radio 20, `bloque` radio 18. */
  tamano?: 'grande' | 'media' | 'bloque'
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const radio =
    tamano === 'grande' ? 'rounded-tarjeta-grande' : tamano === 'media' ? 'rounded-tarjeta' : 'rounded-bloque'
  return (
    <div className={`border border-borde-tarjeta bg-papel ${radio} ${className}`} {...resto}>
      {children}
    </div>
  )
}
