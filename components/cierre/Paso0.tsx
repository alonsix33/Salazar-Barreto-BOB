'use client'

import { COPYS } from '@/lib/copys'
import { capitalizar } from '@/lib/formato'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'

/**
 * Paso 0 · Presentación. `04-cierre-del-mes.md`.
 *
 * Dice cuántos pasos son, que se guarda solo, y qué papeles hay que tener a
 * mano antes de empezar. Al volver a entrar, el usuario ve dónde se quedó.
 */
export function Paso0({ nombreMes, avanzar }: PropsPaso) {
  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-grande cierre-titulo">{COPYS.cierre.titulo(nombreMes)}</h2>
      <p className="tipo-cuerpo text-gris cierre-intro">{COPYS.cierre.intro}</p>

      <p className="tipo-etiqueta-seccion text-gris cierre-etiqueta">{COPYS.cierre.vasANecesitar}</p>
      <ul className="cierre-lista">
        {COPYS.cierre.necesitas.map((n, i) => (
          <li key={n.que} className={`cierre-necesita ${i < 2 ? 'cierre-necesita-linea' : ''}`}>
            <span className={`cierre-marca cierre-marca-${i}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="tipo-cuerpo-lista block">{n.que}</span>
              <span className="tipo-contexto-chico block text-gris cierre-necesita-nota">{n.cuando}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="tipo-cuerpo-menor text-gris cierre-fijos-nota">{COPYS.cierre.fijosPuestos}</p>

      <BotonAvanzar onClick={avanzar}>{capitalizar(COPYS.cierre.empezar)}</BotonAvanzar>
    </div>
  )
}
