'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Cifra, type TamanoCifra } from './Cifra'

/**
 * La cifra que **cuenta desde 0 al abrir**. `02` §6 y `03` P1.
 *
 * Es la única cifra del producto que se anima, y solo la protagonista de la
 * tarjeta noche. El resto son `Cifra` a secas: un número que se mueve sin razón
 * distrae, y aquí la razón es marcar el dato que el ojo busca primero.
 *
 * Tres cuidados, por orden de lo que costaría equivocarse:
 *
 *  1. **Cero salto de hidratación.** El servidor pinta el valor final, y el
 *     primer render del cliente también, así que el HTML coincide. La cuenta
 *     empieza en `useLayoutEffect`, antes del primer pintado, bajando a 0 y
 *     subiendo: nunca se ve el valor final parpadear y caer.
 *  2. **`prefers-reduced-motion` la apaga entera.** Ahí se queda el valor final,
 *     sin contar. `02` §6 lo exige.
 *  3. **Termina exacta.** El último fotograma fija el valor de verdad, no el que
 *     dejó la interpolación: una cuota que cuenta hasta S/ 384.32 en vez de
 *     384.33 es peor que una que no cuenta.
 */
export function CifraContada({
  valor,
  tamano,
  simbolo,
  sobreNoche,
  className,
  duracionMs = 600,
}: {
  valor: number
  tamano: TamanoCifra
  simbolo?: boolean
  sobreNoche?: boolean
  className?: string
  duracionMs?: number
}) {
  const [mostrado, setMostrado] = useState(valor)
  const cuadro = useRef<number>(0)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducido || valor <= 0) {
      setMostrado(valor)
      return
    }
    const inicio = performance.now()
    setMostrado(0)
    const tick = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracionMs)
      // Desaceleración: rápido al principio, se posa al final. `02` §6 usa esta
      // misma curva para la entrada de bloque.
      const suave = 1 - Math.pow(1 - t, 3)
      if (t >= 1) {
        setMostrado(valor) // el valor exacto, no el interpolado
        return
      }
      setMostrado(valor * suave)
      cuadro.current = requestAnimationFrame(tick)
    }
    cuadro.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(cuadro.current)
  }, [valor, duracionMs])

  return (
    <Cifra
      valor={mostrado}
      tamano={tamano}
      simbolo={simbolo}
      sobreNoche={sobreNoche}
      className={className}
    />
  )
}
