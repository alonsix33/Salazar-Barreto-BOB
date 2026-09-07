/**
 * La píldora de estado de un pago. `02` §4.2 y `01` §7.
 *
 * No acepta un color por prop: acepta el **estado**. Nunca hay rojo, porque un
 * pago que falta no es una alarma: son siete personas que se cruzan en el
 * ascensor.
 */

import { COPYS } from '@/lib/copys'
import type { EstadoCuota } from '@/lib/estados'

const CLARO: Record<EstadoCuota, string> = {
  'al-dia': 'bg-verde-suave text-verde-oscuro',
  'sin-registrar': 'bg-ambar-suave text-ambar',
  'en-verificacion': 'bg-neutro-suave text-gris',
}

const SOBRE_NOCHE: Record<EstadoCuota, string> = {
  'al-dia': 'bg-pildora-dia text-verde-claro',
  'sin-registrar': 'bg-pildora-sin text-ambar-claro',
  'en-verificacion': 'bg-pildora-verificacion text-agua-claro',
}

export function PildoraEstado({
  estado,
  sobreNoche = false,
}: {
  estado: EstadoCuota
  sobreNoche?: boolean
}) {
  const paleta = sobreNoche ? SOBRE_NOCHE : CLARO
  return (
    <span
      className={`tipo-pildora shrink-0 whitespace-nowrap rounded-pildora px-pildora-x py-pildora-y ${paleta[estado]}`}
    >
      {COPYS.estados[estado]}
    </span>
  )
}
