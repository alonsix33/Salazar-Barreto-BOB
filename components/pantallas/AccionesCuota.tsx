'use client'

import { COPYS } from '@/lib/copys'
import { BotonSecundario } from '@/components/ui/BotonSecundario'
import { useHoja } from '@/components/hojas/Hojas'

/**
 * Los dos botones del pie de la tarjeta noche de Inicio.
 *
 * *"¿Cómo se calculó?"* abre la hoja del cálculo, que es la pieza central de la
 * transparencia. La flecha lleva a Mi departamento.
 */
export function AccionesCuota() {
  const { abrir } = useHoja()
  return (
    <div className="flex gap-acciones inicio-acciones">
      <BotonSecundario sobreNoche onClick={() => abrir('calculo')}>
        {COPYS.inicio.comoSeCalculo}
      </BotonSecundario>
      <button type="button" onClick={() => abrir('pagar')} className="inicio-flecha" aria-label={COPYS.miDpto.comoPagar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}
