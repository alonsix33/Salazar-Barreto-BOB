import { dptoElegido } from '@/lib/sesion'
import { avisosPara } from '@/lib/datos/avisos'
import { Avisos } from '@/components/pantallas/Avisos'
import { Onboarding } from '@/components/pantallas/Onboarding'

export default async function Pagina() {
  const dpto = await dptoElegido()
  if (!dpto) return <Onboarding />
  return <Avisos dpto={dpto} avisos={await avisosPara(dpto)} />
}
