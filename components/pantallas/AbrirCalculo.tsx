'use client'

import { COPYS } from '@/lib/copys'
import { useHoja } from '@/components/hojas/Hojas'

/**
 * El bloque que explica el agua del mes y abre el cálculo completo.
 *
 * `01` §3.4: aquí nunca se dice "ajustado" ni "Ruta A/B". Se cuenta lo que pasó
 * con los números del mes.
 */
export function AbrirCalculo({ explicacion }: { explicacion: string }) {
  const { abrir } = useHoja()
  return (
    <div className="animar-entrada explica-contenedor">
      <button type="button" onClick={() => abrir('calculo')} className="explica">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="explica-icono" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-5M12 8h.01" />
        </svg>
        <span className="min-w-0 flex-1 text-left">
          <span className="tipo-cuerpo-enlace block text-terra-texto explica-texto">{explicacion}</span>
          <span className="tipo-cuerpo-destacado-medio block text-terra explica-enlace">{COPYS.mes.verCalculo}</span>
        </span>
      </button>
    </div>
  )
}
