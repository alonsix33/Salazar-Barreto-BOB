'use client'

import { Avatar } from '@/components/Avatar'
import { useHoja } from '@/components/hojas/Hojas'
import { nombreMes } from '@/lib/calculo/mes'
import type { MesId } from '@/lib/calculo/tipos'

/**
 * La línea de Bob en Inicio. `05-bob-agente.md` §4.
 *
 * Dos líneas como mucho, siempre con el dato, y **reporta también lo bueno**:
 * no es una lista de pendientes.
 */
export function LineaBob({
  avisados,
  sinRegistrar,
  mes,
}: {
  avisados: readonly string[]
  sinRegistrar: readonly string[]
  mes: MesId
}) {
  const { abrir } = useHoja()

  const texto =
    sinRegistrar.length === 0 && avisados.length === 0
      ? `${capitalizar(nombreMes(mes))} cerró completo: los siete al día.`
      : sinRegistrar.length === 0
        ? `Va bien: solo falta confirmar el pago del ${avisados[0]}.`
        : sinRegistrar.length === 1
          ? `Falta que el ${sinRegistrar[0]} avise.`
          : `Falta que ${sinRegistrar.length} departamentos avisen.`

  return (
    <div className="animar-entrada linea-bob-contenedor">
      <button type="button" onClick={() => abrir('bob')} className="linea-bob">
        <span className="linea-bob-avatar">
          <Avatar tamano="tarjeta" />
        </span>
        <span className="tipo-cuerpo-chico flex-1 text-left">{texto}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gris" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
