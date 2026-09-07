'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Anuncios para lector de pantalla. `02` §8, lo que quedaba pendiente.
 *
 * Una región `aria-live` única, invisible, donde se escribe lo que **acaba de
 * pasar**. Existe por un caso concreto de esa lista: *«anuncio a lector de
 * pantalla cuando cambia el estado de un pago»*. Un vecino ciego que toca «Ya
 * pagué» tiene que enterarse de que su mes pasó a *en verificación*; con el
 * color y la píldora solamente, no se entera de nada.
 *
 * `polite` y no `assertive`: nada de esto interrumpe lo que se esté leyendo.
 * Ninguno de estos avisos es una urgencia.
 *
 * **No sustituye al texto en pantalla.** Lo que se anuncia aquí se ve también:
 * si hubiera que elegir, se elegiría la pantalla.
 */
const ContextoAnuncio = createContext<((texto: string) => void) | null>(null)

export function useAnuncio(): (texto: string) => void {
  const anunciar = useContext(ContextoAnuncio)
  if (!anunciar) throw new Error('useAnuncio fuera de <ProveedorAnuncio>')
  return anunciar
}

export function ProveedorAnuncio({ children }: { children: ReactNode }) {
  const [texto, setTexto] = useState('')

  const anunciar = useCallback((nuevo: string) => {
    // Se limpia antes de escribir: si el texto nuevo es idéntico al anterior,
    // el lector de pantalla no lo repite —no ve un cambio— y el vecino se queda
    // sin enterarse de la segunda vez que pasó lo mismo.
    setTexto('')
    requestAnimationFrame(() => setTexto(nuevo))
  }, [])

  const valor = useMemo(() => anunciar, [anunciar])

  return (
    <ContextoAnuncio.Provider value={valor}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {texto}
      </div>
    </ContextoAnuncio.Provider>
  )
}
