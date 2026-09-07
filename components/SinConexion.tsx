'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { COPYS } from '@/lib/copys'
import { VERSION_APP } from '@/lib/version'
import { haceCuanto } from '@/lib/formato'

/**
 * El aviso de que lo que se ve no viene del servidor, y el registro del service
 * worker. Fase 6, punto 2.
 *
 * Va junto porque son la misma promesa: la app abre sin señal **y lo dice**. Sin
 * el aviso, el service worker sería peor que no tenerlo — enseñaría números de
 * la semana pasada con toda la apariencia de ser los de hoy.
 *
 * **Dos señales, no una.** `navigator.onLine` solo sabe si hay interfaz de red;
 * con el wifi del edificio enganchado y sin salida dice `true` y se queda tan
 * ancho. La segunda señal la manda el propio service worker cuando ha servido
 * algo de la caché (`postMessage`), y es la que cubre el caso de verdad común:
 * conectado en apariencia, sin servidor en realidad.
 */
export function SinConexion() {
  // Arranca en `null` —"todavía no se sabe"— y no en "conectado": en el
  // servidor no hay `navigator`, y pintar el aviso o no pintarlo antes de
  // saberlo daría un desajuste de hidratación.
  const [conectado, setConectado] = useState<boolean | null>(null)
  /** Cuándo se guardó lo que se está viendo, si viene de la caché. */
  const [deCache, setDeCache] = useState<{ guardadoEn: string | null } | null>(null)
  const ruta = usePathname()

  useEffect(() => {
    setConectado(navigator.onLine)
    const arriba = () => {
      setConectado(true)
      // Al volver la señal, lo que se ve sigue siendo lo guardado hasta que algo
      // lo refresque. El aviso se quita en cuanto llegue una respuesta de red,
      // que es lo que hace `desdeCache` al dejar de mandar mensajes.
      setDeCache(null)
    }
    const abajo = () => setConectado(false)
    window.addEventListener('online', arriba)
    window.addEventListener('offline', abajo)
    return () => {
      window.removeEventListener('online', arriba)
      window.removeEventListener('offline', abajo)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const alRecibir = (ev: MessageEvent) => {
      const dato = ev.data as { tipo?: string; guardadoEn?: string | null } | null
      if (dato?.tipo === 'desde-cache') setDeCache({ guardadoEn: dato.guardadoEn ?? null })
    }
    navigator.serviceWorker.addEventListener('message', alRecibir)

    /**
     * El sello del build va en la URL a propósito.
     *
     * Un service worker se actualiza cuando **su URL o sus bytes** cambian, y
     * `public/sw.js` es el mismo fichero en todos los despliegues. Con el sello,
     * cada despliegue registra un worker nuevo, `activate` vuelve a correr y las
     * cachés del despliegue anterior se borran. Sin él, no se borraba ninguna.
     *
     * Sin `catch` esto revienta en un `iframe` con almacenamiento bloqueado y se
     * lleva por delante el resto de efectos del árbol.
     */
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(VERSION_APP)}`).catch(() => {})

    return () => navigator.serviceWorker.removeEventListener('message', alRecibir)
  }, [])

  const enAdmin = ruta?.startsWith('/admin') ?? false

  const texto =
    conectado === false
      ? enAdmin
        ? COPYS.desconectado.avisoAdmin
        : COPYS.desconectado.aviso
      : deCache
        ? deCache.guardadoEn
          ? COPYS.desconectado.noLlegaCon(haceCuanto(deCache.guardadoEn))
          : COPYS.desconectado.noLlega
        : null

  if (texto === null) return null

  return (
    <div className="sin-conexion" role="status" aria-live="polite">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="sin-conexion-icono"
      >
        <path d="M2 2l20 20M8.5 16.4a5 5 0 017 0M5 12.9a10 10 0 013.5-2.3M19 12.9a10 10 0 00-7.6-2.9M1.4 9.4A15 15 0 015 7M22.6 9.4A15 15 0 0013 5.2M12 20h.01" />
      </svg>
      <span className="tipo-contexto sin-conexion-texto">{texto}</span>
    </div>
  )
}
