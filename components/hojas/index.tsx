'use client'

import { useHoja } from './Hojas'
import { HojaAvisoOk } from './HojaAvisoOk'
import { HojaBob } from './HojaBob'
import { HojaCalculo } from './HojaCalculo'
import { HojaHistorial } from './HojaHistorial'
import { HojaPagarConDatos } from './HojaPagarConDatos'
import { HojaWizard } from './HojaWizard'
import { HojaAdminDatos } from './HojaAdminDatos'
import { useContexto } from './Contexto'

/**
 * El despachador de hojas.
 *
 * Cada hoja se monta solo cuando está abierta: así el contenido se pide al
 * servidor en ese momento y no en cada carga de pantalla.
 */
export function Hojas() {
  const { hoja } = useHoja()
  const { mes, dpto } = useContexto()
  if (!hoja) return null
  switch (hoja) {
    case 'bob':
      // Bob no necesita departamento —responde de los totales del edificio
      // igual—, pero sí el mes que se está mirando.
      return mes ? <HojaBob mes={mes} dpto={dpto} /> : null
    case 'aviso-ok':
      return <HojaAvisoOk />
    case 'calculo':
      return mes && dpto ? <HojaCalculo mes={mes} dpto={dpto} /> : null
    case 'pagos':
      return dpto ? <HojaHistorial dpto={dpto} modo="pagos" /> : null
    case 'agua':
      return dpto ? <HojaHistorial dpto={dpto} modo="agua" /> : null
    case 'pagar':
      return mes && dpto ? <HojaPagarConDatos mes={mes} dpto={dpto} /> : null
    case 'wizard':
      return <HojaWizard />
    case 'export':
      return <HojaAdminDatos modo="export" />
    case 'cargos':
      return <HojaAdminDatos modo="cargos" />
    case 'corregir':
      // La lista de meses publicados la trae la misma consulta del panel: la
      // hoja deja elegir cuál se corrige, no solo el último.
      return <HojaAdminDatos modo="corregir" />
    default:
      return null
  }
}
