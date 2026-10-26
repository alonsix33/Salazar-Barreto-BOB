'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import type { Extra } from '@/lib/calculo/tipos'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'
import { EditorExtras } from './EditorExtras'
import { Fallo } from '@/components/ui/Fallo'

/**
 * Paso 5 · Lo puntual. `04-cierre-del-mes.md`.
 *
 * Dos cosas que no se pueden confundir:
 *
 *  - un **gasto extraordinario** se suma al total y lo pagan los siete por flat;
 *  - un **crédito** se resta de la cuota de un departamento y **sale del saldo
 *    de la cuenta**, no del bolsillo de los demás.
 *
 * Y dos requisitos que salieron de corregir el diseño:
 *
 *  - **Lo que se añade aparece listado debajo del botón**, con su monto y quién
 *    lo paga. Antes se seleccionaba y no pasaba nada visible.
 *  - **La reasignación del lavado es una casilla, no un campo.** Viene marcada si
 *    estuvo activa el mes anterior, y el valor en m³ sigue lo configurado en el
 *    panel: no es un número que se escriba aquí a mano.
 */
export function Paso5Puntual({ borrador, guardar, guardando, errorGuardar, avanzar }: PropsPaso) {
  const [extras, setExtras] = useState<Extra[]>(() => borrador.extras)

  const guardarExtras = (lista: Extra[]) => {
    setExtras(lista)
    void guardar('gastos', { extras: lista })
  }

  const lavado = borrador.lavado

  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.puntualTitulo}</h2>
      <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.cierre.puntualIntro}</p>

      <EditorExtras extras={extras} onCambiar={guardarExtras} />

      {lavado && (
        <>
          <p className="tipo-etiqueta-seccion text-gris puntual-etiqueta">{COPYS.cierre.reasignaciones}</p>
          <label className="casilla-fila">
            <input
              type="checkbox"
              checked={lavado.activo}
              onChange={(e) => void guardar('reasignaciones', { activa: e.target.checked })}
              className="casilla"
            />
            <span className="min-w-0 flex-1">
              <span className="tipo-cuerpo-lista block">
                {lavado.dpto} · {lavado.concepto}
              </span>
              <span className="tipo-contexto-chico block text-gris puntual-quien">
                {!lavado.activo
                  ? COPYS.cierre.lavadoInactivo
                  : lavado.aplicado
                    ? COPYS.cierre.lavadoActivo
                    : COPYS.cierre.lavadoNoAplicado}
              </span>
            </span>
            {/* El valor sigue lo configurado en el panel, no se escribe aquí. */}
            <span className="tipo-monto-lista">{fmt(lavado.m3)} m³</span>
          </label>
        </>
      )}

      {errorGuardar && <Fallo>{errorGuardar}</Fallo>}

      <BotonAvanzar onClick={avanzar} cargando={guardando}>
        {extras.length > 0 ? 'Continuar' : COPYS.cierre.nadaMas}
      </BotonAvanzar>
    </div>
  )
}
