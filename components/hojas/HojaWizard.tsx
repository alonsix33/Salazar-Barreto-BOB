'use client'

import { useContexto } from './Contexto'
import { Wizard } from '@/components/cierre/Wizard'
import { Hoja } from './Hoja'

/**
 * Abre el cierre sobre el mes que el panel dice que toca cerrar.
 *
 * **El mes lo decide el servidor, en `panelDeAdmin()`, y llega por el contexto
 * de la hoja.** La primera versión lo volvía a deducir aquí desde `/api/meses`,
 * con una regla parecida pero no igual, y el cierre se abría sobre diciembre de
 * 2025 —el mes base, que existe solo para darle a enero su lectura anterior—
 * mientras el botón del panel decía "Empezar julio". Dos sitios calculando lo
 * mismo es dos sitios donde equivocarse.
 */
export function HojaWizard() {
  const { mes } = useContexto()

  if (!mes) {
    return (
      <Hoja titulo="Cerrar el mes" altura="alta">
        <div className="hoja-cuerpo">
          <p className="tipo-cuerpo-menor text-gris">
            No hay ningún mes por cerrar. Si crees que sí, recarga la pantalla de administración.
          </p>
        </div>
      </Hoja>
    )
  }
  return <Wizard mes={mes} />
}
