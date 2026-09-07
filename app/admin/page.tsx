import { cookies } from 'next/headers'
import { dptoElegido } from '@/lib/sesion'
import { COOKIE_ADMIN, sesionValida } from '@/lib/servicios/admin'
import { PedirPin } from '@/components/pantallas/PedirPin'
import { Onboarding } from '@/components/pantallas/Onboarding'
import { PanelAdmin } from '@/components/pantallas/PanelAdmin'
import { panelDeAdmin } from '@/lib/datos/admin'

/**
 * Administración. Una persona a la vez, con PIN.
 *
 * No hay gestión de roles ni traspaso de turno: decisión tomada, es innecesario
 * para siete personas (`README` §7).
 */
export default async function Pagina() {
  const dpto = await dptoElegido()
  if (!dpto) return <Onboarding />

  const tarro = await cookies()
  if (!sesionValida(tarro.get(COOKIE_ADMIN)?.value)) return <PedirPin />

  return <PanelAdmin datos={await panelDeAdmin()} />
}
