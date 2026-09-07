'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'

/**
 * Las hojas modales. `02` §4.8.
 *
 * **El botón atrás del sistema y el gesto de deslizar cierran la hoja activa
 * antes de navegar.** El prototipo no lo implementa y hay que hacerlo: en
 * Android, deslizar desde el borde con una hoja abierta te sacaba de la app en
 * vez de cerrar la hoja.
 *
 * Se consigue metiendo la hoja en el historial (`pushState`) al abrirla y
 * escuchando `popstate`. Así el gesto y el botón hacen exactamente lo que el
 * usuario espera, sin capturar nada.
 */

export type ClaveHoja =
  | 'bob' | 'calculo' | 'pagos' | 'agua' | 'pagar' | 'aviso-ok'
  | 'wizard' | 'cargos' | 'export' | 'corregir'

interface Contexto {
  hoja: ClaveHoja | null
  abrir: (hoja: ClaveHoja) => void
  cerrar: () => void
}

const ContextoHoja = createContext<Contexto | null>(null)

export function useHoja(): Contexto {
  const ctx = useContext(ContextoHoja)
  if (!ctx) throw new Error('useHoja fuera de <ProveedorHojas>')
  return ctx
}

const MARCA = 'sb-hoja'

export function ProveedorHojas({ children }: { children: ReactNode }) {
  const [hoja, setHoja] = useState<ClaveHoja | null>(null)
  // Distingue "cerré yo" de "el usuario dio atrás", para no desandar dos veces.
  const cerrandoPorHistoria = useRef(false)

  const abrir = useCallback((clave: ClaveHoja) => {
    setHoja((actual) => {
      if (actual === null) {
        window.history.pushState({ [MARCA]: clave }, '')
      } else {
        window.history.replaceState({ [MARCA]: clave }, '')
      }
      return clave
    })
  }, [])

  const cerrar = useCallback(() => {
    setHoja((actual) => {
      if (actual !== null && !cerrandoPorHistoria.current) {
        // Desandar el `pushState`: así el atrás del sistema no queda desfasado.
        window.history.back()
      }
      return null
    })
  }, [])

  useEffect(() => {
    const alVolver = (ev: PopStateEvent) => {
      // `history.state` es `any` por definición del DOM; se lee una sola marca.
    const clave = (ev.state as Record<string, unknown> | null)?.[MARCA]
      cerrandoPorHistoria.current = true
      // `clave` se guardó con `pushState` desde `abrir(clave: ClaveHoja)`, así que
    // si es una cadena, es una de las claves de hoja.
    setHoja(typeof clave === 'string' ? (clave as ClaveHoja) : null)
      queueMicrotask(() => {
        cerrandoPorHistoria.current = false
      })
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  /**
   * Escape cierra, como en cualquier modal.
   *
   * Con el teclado numérico abierto **no llega hasta aquí**: el teclado escucha
   * en fase de captura y para el evento. Antes subía, se cerraba la hoja de
   * debajo, y el teclado se quedaba solo en pantalla sin nada detrás y sin forma
   * de cerrarlo salvo recargar la página.
   */
  useEffect(() => {
    if (!hoja) return
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [hoja, cerrar])

  const valor = useMemo(() => ({ hoja, abrir, cerrar }), [hoja, abrir, cerrar])
  return <ContextoHoja.Provider value={valor}>{children}</ContextoHoja.Provider>
}
