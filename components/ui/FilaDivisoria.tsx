import type { ReactNode } from 'react'

/**
 * Una fila de lista con divisoria inferior. `02` §3: **preferir divisorias a
 * tarjetas**.
 */
export function FilaDivisoria({
  children,
  className = '',
  sinLinea = false,
  alta = false,
  ...resto
}: {
  children: ReactNode
  className?: string
  sinLinea?: boolean
  /** 14px en vez de 13px de padding vertical. */
  alta?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center gap-fila-x ${alta ? 'py-fila-alta' : 'py-fila'} ${
        sinLinea ? '' : 'border-b border-linea'
      } ${className}`}
      {...resto}
    >
      {children}
    </div>
  )
}
