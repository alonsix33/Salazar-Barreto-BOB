'use client'

import { usePathname } from 'next/navigation'
import { NavInferior } from './NavInferior'

/**
 * La barra inferior solo aparece en las cuatro pantallas que navega.
 *
 * `README` §6: `avisos` y `admin` son pantallas completas sin nav — se sale con
 * la flecha. Y el onboarding tampoco la lleva: sin departamento elegido no hay
 * a dónde ir.
 */
const CON_NAV = ['/', '/mes', '/mi-departamento', '/historial']

export function NavSiCorresponde({ hayDpto }: { hayDpto: boolean }) {
  const ruta = usePathname()
  if (!hayDpto) return null
  const lleva = CON_NAV.some((r) => (r === '/' ? ruta === '/' : ruta.startsWith(r)))
  if (!lleva) return null
  return <NavInferior />
}
