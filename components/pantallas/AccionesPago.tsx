'use client'

import { COPYS } from '@/lib/copys'
import { useHoja } from '@/components/hojas/Hojas'
import { nombreMes } from '@/lib/calculo/mes'
import type { DptoId, MesId } from '@/lib/calculo/tipos'

/**
 * "Cómo pagar" y "Ya pagué".
 *
 * Solo aparecen si el pago está sin registrar: a quien ya avisó no se le sigue
 * pidiendo algo que ya dijo que hizo. Es "vecinos, no morosos" aplicado a un
 * estado de datos.
 *
 * El mes y el departamento van en el `aria-label` de cada botón, no en un texto
 * suelto para lector de pantalla. Antes había un `<span className="sr-only">` con
 * «2026-06 · 401» dentro: dos identificadores crudos, sin verbo y sin contexto,
 * leídos en voz alta después de dos botones. No decía nada.
 */
export function AccionesPago({ mes, dpto }: { mes: MesId; dpto: DptoId }) {
  const { abrir } = useHoja()
  return (
    <div className="flex gap-acciones midpto-acciones">
      <button
        type="button"
        onClick={() => abrir('pagar')}
        aria-label={`${COPYS.miDpto.comoPagar} la cuota de ${nombreMes(mes)} del ${dpto}`}
        className="midpto-boton-pagar"
      >
        {COPYS.miDpto.comoPagar}
      </button>
      <button
        type="button"
        onClick={() => abrir('pagar')}
        aria-label={`${COPYS.miDpto.yaPague} la cuota de ${nombreMes(mes)} del ${dpto}`}
        className="midpto-boton-avisar"
      >
        {COPYS.miDpto.yaPague}
      </button>
    </div>
  )
}
