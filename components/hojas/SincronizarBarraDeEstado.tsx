'use client'

import { useEffect } from 'react'
import { useHoja } from './Hojas'
import { COLOR_TEMA, COLOR_TEMA_HOJA } from '@/lib/tema'

/**
 * La barra de estado del sistema —fuera del DOM— no se oscurece con el
 * velo de una hoja.
 *
 * `.velo` (`app/globals.css`) es un elemento de la página: cubre `.marco-app`
 * entero, notch incluido, pero la franja que pinta el sistema operativo con
 * `theme-color` no es DOM, así que ningún `backdrop-filter` ni opacidad la
 * toca. El resultado, sin esto: una franja crema y sólida arriba, y justo
 * debajo el resto de la pantalla ya oscurecido —dos zonas que deberían leerse
 * como una sola.
 *
 * La técnica estándar es actualizar `<meta name="theme-color">` a mano
 * cuando cambia el estado que le importa al usuario. Aquí ese estado es
 * "hay una hoja abierta", que `useHoja()` ya sabe.
 */
export function SincronizarBarraDeEstado() {
  const { hoja } = useHoja()

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    meta.setAttribute('content', hoja ? COLOR_TEMA_HOJA : COLOR_TEMA)
  }, [hoja])

  return null
}
