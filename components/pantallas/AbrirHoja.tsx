'use client'

import type { ReactNode } from 'react'
import { useHoja, type ClaveHoja } from '@/components/hojas/Hojas'

/** Una tarjeta entera que abre una hoja. Es un `<button>`, no un `div` con onClick. */
export function AbrirHoja({
  hoja,
  children,
  className = '',
}: {
  hoja: ClaveHoja
  children: ReactNode
  className?: string
}) {
  const { abrir } = useHoja()
  return (
    <button type="button" onClick={() => abrir(hoja)} className={`w-full text-left ${className}`}>
      {children}
    </button>
  )
}
