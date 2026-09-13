'use client'

import { useEffect } from 'react'

/**
 * Mejor esfuerzo: pide bloquear la orientación a vertical.
 *
 * Funciona de verdad en muy pocos sitios —una PWA instalada en Android, en
 * modo standalone— y falla en silencio en todos los demás: una pestaña de
 * navegador normal, o cualquier cosa en iOS, donde Safari no expone esta API
 * para una app agregada a inicio. Por eso es "mejor esfuerzo" y no la
 * defensa real: la real es el CSS de `AvisoVertical`, que no depende de que
 * esto funcione.
 */
/** `lock()` es real (Chromium, Android) pero los tipos del DOM de TypeScript
 *  no la incluyen: no está en la versión estable de la especificación. El
 *  `as` es seguro porque todo el uso está detrás de un `?.` y un `catch`. */
type OrientacionConBloqueo = ScreenOrientation & { lock?: (orientacion: string) => Promise<void> }

export function useBloqueoDeOrientacion() {
  useEffect(() => {
    const orientacion = screen.orientation as OrientacionConBloqueo | undefined
    orientacion?.lock?.('portrait')?.catch(() => {})
  }, [])
}
