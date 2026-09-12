'use client'

import { COPYS } from '@/lib/copys'
import { fmt, fmt3 } from '@/lib/calculo/redondeo'
import type { PropuestaLectura } from '@/lib/calculo/correccion'
import { AvisoBob } from './AvisoBob'

/**
 * La propuesta de corrección de tecleo. `04-cierre-del-mes.md` § *Corrección de tecleo*.
 *
 * **Nunca corrige sola.** Dos botones y el administrador decide; no hay tercera
 * vía ni acción por omisión. La frase la arma `COPYS.cierre.propuesta` a partir
 * de las condiciones de §8 que la lectura tecleada de verdad incumple.
 *
 * Vive aquí y no dentro de un paso porque la enseñan dos: el paso 1 cuando se
 * reedita una lectura con el recibo ya escrito, y el paso 2 en cuanto se escriben
 * los m³ —que es el primer momento del cierre en que la regla se puede evaluar—.
 */
export function PropuestaCorreccion({
  propuesta,
  aceptar,
  mantener,
  ocupado,
}: {
  propuesta: PropuestaLectura
  aceptar: () => void
  mantener: () => void
  ocupado: boolean
}) {
  return (
    <div className="cierre-correccion" data-propuesta={propuesta.dpto}>
      {/*
        El único texto automático de Bob que **no** pasa por el modelo, y está
        declarado así en `MOMENTOS['cierre-propuesta']` con el motivo: lo que
        dice lleva la lectura tecleada, la anterior y la propuesta con tres
        decimales, y justo debajo hay dos botones que escriben exactamente esa
        cifra. Un texto redactado de nuevo, aunque fuera correcto, podría
        describir un número distinto del que el botón va a guardar, y ahí no hay
        guarda que valga: los dos números existirían.
      */}
      <AvisoBob>
        {COPYS.cierre.propuesta({
          valor: fmt3(propuesta.valor),
          tecleado: fmt3(propuesta.tecleado),
          anterior: fmt3(propuesta.anterior),
          consumoTecleado: fmt(propuesta.consumoTecleado),
          veces: propuesta.veces,
          motivos: propuesta.motivos,
        })}
      </AvisoBob>
      <div className="flex gap-acciones cierre-correccion-botones">
        <button
          type="button"
          onClick={aceptar}
          disabled={ocupado}
          className="cierre-correccion-si"
        >
          {COPYS.cierre.propuestaSi(fmt3(propuesta.valor))}
        </button>
        <button
          type="button"
          onClick={mantener}
          disabled={ocupado}
          className="cierre-correccion-no"
        >
          {COPYS.cierre.propuestaNo}
        </button>
      </div>
    </div>
  )
}
