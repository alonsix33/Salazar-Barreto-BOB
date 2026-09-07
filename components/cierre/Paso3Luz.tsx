'use client'

import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { useNumpad } from '@/components/Numpad'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'
import { AvisoBob } from './AvisoBob'
import { CampoNumerico } from './CampoNumerico'
import { Fallo } from '@/components/ui/Fallo'

/** Paso 3 · El recibo de luz común. Un solo campo. `04-cierre-del-mes.md`. */
export function Paso3Luz({ borrador, guardar, guardando, errorGuardar, avanzar }: PropsPaso) {
  const { abrir } = useNumpad()
  const luz = borrador.resultado.rec.luz
  const tiene = luz > 0

  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.luzTitulo}</h2>
      <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.cierre.luzIntro}</p>

      <CampoNumerico
        etiqueta={COPYS.cierre.campoLuz}
        valor={tiene ? fmt(luz) : null}
        prefijo="S/"
        onTocar={() =>
          abrir({
            etiqueta: COPYS.cierre.campoLuz,
            valorInicial: tiene ? luz : null,
            decimales: true,
            maxDecimales: 2,
            sufijo: 'S/',
            onOk: (v) => void guardar('recibo', { luz: v }),
          })
        }
      />

      {tiene && <AvisoBob>{compararLuz(luz, borrador.luzAnteriores)}</AvisoBob>}
      {errorGuardar && <Fallo>{errorGuardar}</Fallo>}

      <BotonAvanzar onClick={avanzar} bloqueadoPor={tiene ? null : COPYS.cierre.faltaMonto} cargando={guardando}>
        Continuar
      </BotonAvanzar>
    </div>
  )
}

/**
 * Lo que Bob dice del recibo de luz. `04-cierre-del-mes.md` §Paso 3: «Bob
 * compara con el mes anterior». La versión anterior repetía el número que el
 * administrador acababa de teclear y le pedía revisarlo, que es justo lo que el
 * paso 2 arregló y su comentario documenta. Sin meses con que comparar, se calla.
 */
function compararLuz(luz: number, anteriores: { mes: string; luz: number }[]): string {
  if (anteriores.length === 0) {
    return `S/ ${fmt(luz)} de luz común este mes. Es el primero, así que todavía no hay con qué compararlo.`
  }
  const lista = anteriores.map((a) => `${a.mes} S/ ${fmt(a.luz)}`).join(' y ')
  const media = anteriores.reduce((s, a) => s + a.luz, 0) / anteriores.length
  return luz > media * 1.15
    ? `S/ ${fmt(luz)} es bastante más que los últimos meses (${lista}). ¿Lo confirmas?`
    : `S/ ${fmt(luz)} está en línea con los últimos meses: ${lista}.`
}
