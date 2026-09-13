'use client'

import { useEffect, useState } from 'react'
import type { DatosMomento, MomentoId } from '@/lib/bob/momentos'

/**
 * Un texto de Bob que sale solo, y que el modelo puede reescribir por detrás.
 *
 * Lo que llega del servidor se pinta **ya**, en el HTML, y es la respuesta
 * buena: sale del catálogo determinista y es correcta con o sin DeepSeek. Lo
 * único que hace esto es pedir en segundo plano la versión redactada y, si
 * llega y pasa las guardas del servidor, cambiarla en su sitio.
 *
 * No hay estado de carga a propósito, y es la decisión de diseño de todo esto:
 * un «pensando…» en un texto que **nadie pidió** es peor que no tenerlo. El
 * vecino abrió Inicio, no le preguntó nada a Bob. Si el modelo tarda ocho
 * segundos o no contesta nunca, la pantalla se ve exactamente igual de bien.
 *
 * Por eso tampoco reserva alto ni deja hueco: el texto ya ocupa lo que ocupa, y
 * la caja que lo envuelve crece o encoge sola. De eso se encarga el CSS de los
 * globos, que parte las palabras largas y no tiene alto fijo.
 */
export function BobDice({
  momento,
  datos,
  children,
  mes,
  dpto,
  mejorable = true,
}: {
  momento: MomentoId
  datos: DatosMomento
  /** Lo que dice el catálogo. Es lo que se ve mientras no haya nada mejor. */
  children: string
  mes: string
  dpto: string | null
  /** `false` para los momentos que no se le pasan al modelo. */
  mejorable?: boolean
}) {
  const [texto, setTexto] = useState(children)

  /**
   * Si el servidor cambia el texto del catálogo —porque se tecleó otra lectura,
   * porque cambió el mes— manda el nuevo, no el que el modelo redactó del
   * anterior. Sin esto, corregir un dato dejaba en pantalla la frase que
   * hablaba del dato viejo, que es la peor clase de mentira: la que fue verdad.
   */
  useEffect(() => {
    setTexto(children)
  }, [children])

  const huella = JSON.stringify(datos)

  useEffect(() => {
    if (!mejorable) return
    const corte = new AbortController()
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch('/api/bob/momento', {
          method: 'POST',
          signal: corte.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ momento, datos: JSON.parse(huella) as DatosMomento, mes, dpto }),
        })
        if (!r.ok) return
        const cuerpo = (await r.json()) as { texto?: string | null }
        if (vivo && cuerpo.texto) setTexto(cuerpo.texto)
      } catch {
        // Sin red, sin clave o con el modelo caído se queda lo que ya había, que
        // es correcto. No hay nada que avisar porque no falta nada.
      }
    })()
    return () => {
      vivo = false
      corte.abort()
    }
  }, [momento, huella, mes, dpto, mejorable])

  return <>{texto}</>
}
