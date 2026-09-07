'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useHoja } from './Hojas'

/**
 * El contenedor visual de una hoja. `02` §4.8.
 *
 * Fondo crema, `border-radius: 32px 32px var(--rad) var(--rad)` —la esquina de
 * abajo sigue al marco—, asa de arrastre, y detrás el fondo oscurecido.
 *
 * Lleva **trampa de foco**: con la hoja abierta, tabular no puede salirse a la
 * pantalla de atrás. Es lo que `02` §8 marca como pendiente.
 *
 * Y el panel es alcanzable con el tabulador (`tabIndex={0}`), no solo por
 * programa. Con `-1` era focusable para el código y nadie más: las hojas de solo
 * lectura —el cálculo del mes, el consumo de agua— no tienen ni un botón dentro,
 * así que quien navega con teclado no podía llegar a ellas **ni desplazarlas**.
 * Una hoja llena de cifras que no se puede bajar es una hoja vacía.
 */

const ALTURAS = {
  /** Bob ocupa casi toda la altura. */
  completa: 'hoja-completa',
  /** Cálculo, agua, pagos y el cierre del mes. */
  alta: 'hoja-alta',
  /** El resto. */
  media: 'hoja-media',
} as const

export function Hoja({
  children,
  titulo,
  altura = 'media',
  columna = false,
}: {
  children: ReactNode
  /** Lo que anuncia el lector de pantalla al abrirse. */
  titulo: string
  altura?: keyof typeof ALTURAS
  /**
   * La hoja no se desplaza entera: se reparte en cabecera, cuerpo con su propio
   * desplazamiento, y pie fijo. Lo usa Bob, donde el campo de escribir tiene que
   * quedarse abajo mientras la conversación sube.
   */
  columna?: boolean
}) {
  const { cerrar } = useHoja()
  const panel = useRef<HTMLDivElement>(null)
  const antes = useRef<HTMLElement | null>(null)

  useEffect(() => {
    antes.current = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const alTabular = (ev: KeyboardEvent) => {
      if (ev.key !== 'Tab' || !panel.current) return
      /**
       * Si el foco ya está fuera del panel, esta trampa no es la que manda.
       *
       * El teclado numérico se pinta **fuera** de la hoja —lo renderiza su
       * proveedor, encima de todo— y esta trampa lo trataba como "fuera", así
       * que devolvía el foco a la hoja de detrás cada vez que se intentaba
       * entrar en él. Resultado: con el teclado abierto no se podía teclear ni
       * un dígito, y la app entera dejaba de poder administrarse sin ratón.
       */
      if (!panel.current.contains(document.activeElement)) return
      // El propio panel entra en la lista: es el primer alto del recorrido y,
      // en una hoja de solo lectura, el único.
      const focos = [
        panel.current,
        ...panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ]
      if (focos.length === 0) return
      const primero = focos[0]!
      const ultimo = focos[focos.length - 1]!
      if (ev.shiftKey && document.activeElement === primero) {
        ev.preventDefault()
        ultimo.focus()
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTabular)
    return () => {
      document.removeEventListener('keydown', alTabular)
      antes.current?.focus()
    }
  }, [])

  return (
    <>
      <button type="button" className="velo" onClick={cerrar} aria-label="Cerrar" tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={0}
        className={`hoja animar-hoja ${columna ? 'hoja-columna' : 'scroll-limpio'} ${ALTURAS[altura]}`}
      >
        <div className="asa-contenedor">
          <span className="asa" />
        </div>
        {children}
      </div>
    </>
  )
}
