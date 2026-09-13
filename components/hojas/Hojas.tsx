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
  | 'wizard' | 'cargos' | 'export' | 'corregir' | 'confirmar-pagos'

interface Contexto {
  hoja: ClaveHoja | null
  /**
   * La hoja sigue montada durante su animación de salida: `hoja` todavía dice
   * cuál es, pero `cerrando` le dice a `Hoja.tsx` que anime hacia abajo en vez
   * de quedarse. Sin esto, cerrar es un corte seco —la hoja que se veía bajar
   * al abrir desaparecía de golpe al cerrar— en vez de un solo gesto completo.
   */
  cerrando: boolean
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

/** Tiene que coincidir con `--duracion-hoja-cierre` de `globals.css`. */
const DURACION_CIERRE_MS = 240

export function ProveedorHojas({ children }: { children: ReactNode }) {
  const [hoja, setHoja] = useState<ClaveHoja | null>(null)
  const [cerrando, setCerrando] = useState(false)
  // Distingue "cerré yo" de "el usuario dio atrás", para no desandar dos veces.
  const cerrandoPorHistoria = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Espejo síncrono de `hoja`, para leerlo sin pasar por la forma funcional
   * de `setState`.
   *
   * `abrir`/`cerrar` leían el valor "actual" con `setHoja((actual) => {...
   * efecto secundario ...})`. En `next dev`, con `reactStrictMode: true`,
   * React invoca esa función dos veces a propósito para cazar impurezas —y
   * el `pushState`/`history.back()` de dentro se ejecutaba las dos veces de
   * verdad. Abrir una hoja dejaba DOS entradas de historial con la misma
   * marca; al cerrar, `history.back()` caía en la primera de esas dos
   * —todavía con la marca puesta—, y `alVolver` la interpretaba como "el
   * usuario pidió volver a abrirla": la hoja se cerraba y se reabría sola.
   * Leyendo de una ref en vez de la forma funcional, el efecto secundario
   * corre una sola vez pase lo que pase.
   */
  const hojaRef = useRef<ClaveHoja | null>(null)

  const cancelarTemporizador = useCallback(() => {
    if (temporizador.current !== null) {
      clearTimeout(temporizador.current)
      temporizador.current = null
    }
  }, [])

  useEffect(() => cancelarTemporizador, [cancelarTemporizador])

  const fijarHoja = useCallback((clave: ClaveHoja | null) => {
    hojaRef.current = clave
    setHoja(clave)
  }, [])

  const abrir = useCallback(
    (clave: ClaveHoja) => {
      cancelarTemporizador()
      setCerrando(false)
      if (hojaRef.current === null) {
        window.history.pushState({ [MARCA]: clave }, '')
      } else {
        window.history.replaceState({ [MARCA]: clave }, '')
      }
      fijarHoja(clave)
    },
    [cancelarTemporizador, fijarHoja],
  )

  /**
   * Deja la hoja actual montada `DURACION_CIERRE_MS` más, animándose hacia
   * abajo, y solo entonces la desmonta. Es lo mismo pase lo que pase: un
   * toque en el velo, Escape, el asa, o el botón/gesto atrás del sistema.
   *
   * **El `history.back()` se dispara al final, no al empezar.** Era al
   * revés, y eso abría una carrera real: si `abrir()` se llamaba mientras la
   * hoja todavía se veía bajando —240ms es tiempo de sobra para un toque en
   * la pantalla de atrás, que `pointer-events:none` en el velo deja
   * alcanzable a propósito—, el `back()` de la hoja que se estaba cerrando
   * seguía en vuelo cuando la nueva ya se había abierto. Al resolverse, ese
   * `back()` volvía a una entrada de historial que ya no correspondía a lo
   * que se veía en pantalla, y la hoja recién abierta se cerraba sola.
   *
   * Al esperar al final: si `abrir()` llega antes de que el plazo se cumpla,
   * `cancelarTemporizador()` mata este temporizador **antes de que exista
   * ningún `back()` que competir con nada** — nunca se llega a tocar el
   * historial por la hoja que se estaba cerrando, y `abrir()` reemplaza su
   * entrada tranquilamente, como si nunca hubiera empezado a cerrarse.
   */
  const empezarCierre = useCallback(
    (conRetroceso: boolean) => {
      cancelarTemporizador()
      setCerrando(true)
      temporizador.current = setTimeout(() => {
        if (conRetroceso) window.history.back()
        fijarHoja(null)
        setCerrando(false)
        temporizador.current = null
      }, DURACION_CIERRE_MS)
    },
    [cancelarTemporizador, fijarHoja],
  )

  const cerrar = useCallback(() => {
    /**
     * Sin esta guarda: un segundo toque en el velo o el asa mientras la hoja
     * todavía se ve bajando —240ms es tiempo de sobra para un segundo toque
     * de quien no ve reaccionar nada todavía— pedía un segundo cierre sobre
     * uno que ya estaba en curso.
     */
    if (cerrando) return
    if (hojaRef.current === null) return
    // Si esto llegó por `alVolver` (el back del sistema), el historial ya
    // se movió solo: pedir otro `back()` aquí duplicaría la navegación.
    empezarCierre(!cerrandoPorHistoria.current)
  }, [cerrando, empezarCierre])

  useEffect(() => {
    const alVolver = (ev: PopStateEvent) => {
      // `history.state` es `any` por definición del DOM; se lee una sola marca.
      const clave = (ev.state as Record<string, unknown> | null)?.[MARCA]
      cerrandoPorHistoria.current = true
      // `clave` se guardó con `pushState` desde `abrir(clave: ClaveHoja)`, así que
      // si es una cadena, es una de las claves de hoja.
      if (typeof clave === 'string') {
        cancelarTemporizador()
        setCerrando(false)
        fijarHoja(clave as ClaveHoja)
      } else if (hojaRef.current !== null) {
        // El historial ya se movió —esto es la respuesta a ese cambio—,
        // así que el cierre no vuelve a tocarlo.
        empezarCierre(false)
      }
      queueMicrotask(() => {
        cerrandoPorHistoria.current = false
      })
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [cancelarTemporizador, empezarCierre, fijarHoja])

  /**
   * Escape cierra, como en cualquier modal.
   *
   * Con el teclado numérico abierto **no llega hasta aquí**: el teclado escucha
   * en fase de captura y para el evento. Antes subía, se cerraba la hoja de
   * debajo, y el teclado se quedaba solo en pantalla sin nada detrás y sin forma
   * de cerrarlo salvo recargar la página.
   */
  useEffect(() => {
    if (!hoja || cerrando) return
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [hoja, cerrando, cerrar])

  const valor = useMemo(() => ({ hoja, cerrando, abrir, cerrar }), [hoja, cerrando, abrir, cerrar])
  return <ContextoHoja.Provider value={valor}>{children}</ContextoHoja.Provider>
}
