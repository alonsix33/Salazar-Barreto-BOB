import type { ReactNode } from 'react'

/**
 * El protagonista. `02` §4.1.
 *
 * **Una por pantalla.** Es lo que el ojo busca primero; dos compiten. En Inicio
 * es la cuota del usuario; en El mes, el costo total; en Mi departamento, la
 * cuota desglosada; en Historial, el saldo de la cuenta.
 */
export function TarjetaNoche({
  children,
  className = '',
  as: Etiqueta = 'section',
  ...resto
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Etiqueta
      data-bloque-noche
      className={`rounded-noche bg-noche p-interior-grande text-sobre-noche ${className}`}
      {...resto}
    >
      {children}
    </Etiqueta>
  )
}
