'use client'

import { COPYS } from '@/lib/copys'
import { olvidarDepartamento } from '@/app/acciones'

/** "Cambiar" · vuelve al onboarding. `03-pantallas.md` P3. */
export function CambiarDpto() {
  return (
    <form action={olvidarDepartamento}>
      <button type="submit" className="tipo-cuerpo-enlace text-terra">
        {COPYS.miDpto.cambiar}
      </button>
    </form>
  )
}
