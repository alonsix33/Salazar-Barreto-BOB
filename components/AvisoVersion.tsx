'use client'

import { useEffect, useState } from 'react'
import { COPYS } from '@/lib/copys'

/**
 * El aviso de que hay una versión nueva.
 *
 * Una PWA instalada no se actualiza sola como una página: el service worker
 * nuevo se queda **esperando** a que se cierren todas las pestañas, y mientras
 * tanto el vecino puede pasar semanas con la versión de hace tres despliegues
 * sin enterarse. Si en ese tiempo cambió una regla de cálculo, está viendo
 * cifras viejas y no tiene forma de saberlo.
 *
 * Así que se le dice, y se le da un botón. Al pulsarlo:
 *
 *   1. se le manda `ACTUALIZAR` al worker que espera,
 *   2. ese llama a `skipWaiting()` y toma el control,
 *   3. el navegador dispara `controllerchange` y aquí se recarga la página.
 *
 * Recargar **entera** es lo importante: lo que no se puede es tener el
 * JavaScript viejo con los archivos nuevos.
 *
 * ## Por qué no se actualiza solo, sin preguntar
 *
 * Porque puede estar a mitad de un cierre de mes con siete lecturas tecleadas.
 * Recargar por debajo sería perderle el trabajo. El aviso no bloquea nada: se
 * puede seguir usando la app e ignorarlo, y sigue ahí cuando termine.
 */
export function AvisoVersion() {
  const [esperando, setEsperando] = useState<ServiceWorker | null>(null)
  const [actualizando, setActualizando] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let vivo = true

    /**
     * ¿Había ya un worker al cargar la página?
     *
     * **Esto decide si se puede recargar, y no es un detalle.** En la primera
     * visita la página se abre sin controlador, el worker se instala y hace
     * `clients.claim()`, y eso dispara `controllerchange` igual que una
     * actualización. Sin esta bandera, la app se recargaba sola nada más
     * entrar: 83 pruebas de pantalla se cayeron con «execution context was
     * destroyed», que es el navegador diciendo justo eso.
     */
    const habiaControlador = navigator.serviceWorker.controller !== null

    /**
     * Recargar cuando el worker nuevo toma el control.
     *
     * Va fuera del botón a propósito: si hay dos pestañas abiertas y se
     * actualiza en una, la otra también tiene que recargar, o se queda con la
     * versión vieja corriendo sobre los archivos nuevos.
     */
    let recargando = false
    const alCambiar = () => {
      if (!habiaControlador || recargando) return
      recargando = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', alCambiar)

    navigator.serviceWorker.ready
      .then((reg) => {
        if (!vivo) return
        // Puede haber uno esperando desde antes de abrir la app.
        if (reg.waiting && navigator.serviceWorker.controller) setEsperando(reg.waiting)

        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing
          if (!nuevo) return
          nuevo.addEventListener('statechange', () => {
            // `controller` distingue una actualización de la primera
            // instalación: en la primera no hay nada viejo que avisar.
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller && vivo) {
              setEsperando(nuevo)
            }
          })
        })
      })
      .catch(() => {
        // Sin service worker no hay nada que avisar, y no es un error.
      })

    return () => {
      vivo = false
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiar)
    }
  }, [])

  if (!esperando) return null

  return (
    <div className="aviso-version" role="status">
      <span className="aviso-version-texto tipo-cuerpo-chico">{COPYS.version.hayNueva}</span>
      <button
        type="button"
        className="aviso-version-boton"
        disabled={actualizando}
        onClick={() => {
          setActualizando(true)
          esperando.postMessage({ tipo: 'ACTUALIZAR' })
          /**
           * Red de seguridad: si `controllerchange` no llega en tres segundos
           * —pasa cuando el worker se quedó a medias—, se recarga igual. Sin
           * esto el botón se queda en «Actualizando…» para siempre.
           */
          window.setTimeout(() => window.location.reload(), 3000)
        }}
      >
        {actualizando ? COPYS.version.actualizando : COPYS.version.actualizar}
      </button>
    </div>
  )
}
