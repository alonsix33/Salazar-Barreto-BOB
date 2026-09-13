'use client'

import { Avatar } from '@/components/Avatar'
import { BobDice } from '@/components/BobDice'
import { useHoja } from '@/components/hojas/Hojas'
import { nombreMes } from '@/lib/calculo/mes'
import { MOMENTOS } from '@/lib/bob/momentos'
import type { DptoId, MesId } from '@/lib/calculo/tipos'

/**
 * La línea de Bob en Inicio. `05-bob-agente.md` §4.
 *
 * Dos líneas como mucho, siempre con el dato, y **reporta también lo bueno**:
 * no es una lista de pendientes.
 *
 * Lo que dice ya no se escribe aquí: sale de `MOMENTOS['inicio-pagos']`, que es
 * donde están los siete textos que Bob suelta sin que nadie le pregunte. Estaba
 * repartido por siete ficheros y no había forma de saber de un vistazo cuándo
 * habla ni qué dice. Y de paso, con la clave de DeepSeek puesta, esta frase
 * pasa por el modelo como las de la hoja: `BobDice` pinta esta y la cambia si
 * llega algo mejor.
 */
export function LineaBob({
  avisados,
  sinRegistrar,
  mes,
  dpto,
}: {
  avisados: readonly string[]
  sinRegistrar: readonly string[]
  mes: MesId
  dpto: DptoId | null
}) {
  const { abrir } = useHoja()

  const datos = {
    nombreMes: nombreMes(mes),
    avisados: [...avisados],
    sinRegistrar: [...sinRegistrar],
  }

  return (
    <div className="animar-entrada linea-bob-contenedor">
      <button type="button" onClick={() => abrir('bob')} className="linea-bob">
        <span className="linea-bob-avatar">
          <Avatar tamano="tarjeta" />
        </span>
        <span className="tipo-cuerpo-chico linea-bob-texto flex-1 text-left">
          <BobDice momento="inicio-pagos" datos={datos} mes={mes} dpto={dpto}>
            {MOMENTOS['inicio-pagos'].determinista(datos)}
          </BobDice>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gris" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}
