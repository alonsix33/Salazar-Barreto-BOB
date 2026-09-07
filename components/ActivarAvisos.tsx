'use client'

import { useEffect, useState } from 'react'
import { COPYS } from '@/lib/copys'

/**
 * Activar los avisos push en este dispositivo. `06` §9.6.7.
 *
 * Funciona en el navegador y en la PWA instalada. Solo aparece si el navegador
 * soporta push y hay clave pública configurada; si no, no ofrece algo muerto.
 * El push de verdad se prueba **desplegado** (HTTPS + claves reales).
 */
type Estado = 'cargando' | 'no-soportado' | 'sin-configurar' | 'desactivado' | 'activando' | 'activado' | 'bloqueado'

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/**
 * La clave pública VAPID (base64url) al `ArrayBuffer` que pide
 * `pushManager.subscribe`. Se devuelve el buffer y no el `Uint8Array` porque el
 * typing estricto de TS distingue `ArrayBuffer` de `ArrayBufferLike`, y
 * `applicationServerKey` quiere el primero.
 */
function claveABuffer(base64: string): ArrayBuffer {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(normal)
  const buffer = new ArrayBuffer(crudo.length)
  const vista = new Uint8Array(buffer)
  for (let i = 0; i < crudo.length; i++) vista[i] = crudo.charCodeAt(i)
  return buffer
}

export function ActivarAvisos() {
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    const soporta =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    if (!soporta) return setEstado('no-soportado')
    if (!CLAVE) return setEstado('sin-configurar')
    if (Notification.permission === 'denied') return setEstado('bloqueado')
    // ¿Ya está suscrito este dispositivo?
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'activado' : 'desactivado'))
      .catch(() => setEstado('desactivado'))
  }, [])

  const activar = async () => {
    setEstado('activando')
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') return setEstado(permiso === 'denied' ? 'bloqueado' : 'desactivado')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveABuffer(CLAVE),
      })
      const json = sub.toJSON()
      const r = await fetch('/api/push/suscribir', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      })
      setEstado(r.ok ? 'activado' : 'desactivado')
    } catch {
      setEstado('desactivado')
    }
  }

  const desactivar = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/desuscribir', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
    } finally {
      setEstado('desactivado')
    }
  }

  // No se muestra nada si no se puede: ni sin soporte, ni sin clave, ni cargando.
  if (estado === 'cargando' || estado === 'no-soportado' || estado === 'sin-configurar') return null

  return (
    <div className="avisos-push">
      <span className="min-w-0 flex-1">
        <span className="tipo-cuerpo-lista block">{COPYS.push.titulo}</span>
        <span className="tipo-contexto-chico block text-gris">
          {estado === 'bloqueado' ? COPYS.push.bloqueado : COPYS.push.explica}
        </span>
      </span>
      {estado === 'activado' ? (
        <button type="button" onClick={desactivar} className="avisos-push-boton avisos-push-off">
          {COPYS.push.desactivar}
        </button>
      ) : (
        <button
          type="button"
          onClick={activar}
          aria-disabled={estado === 'activando' || estado === 'bloqueado'}
          className="avisos-push-boton"
        >
          {estado === 'activando' ? COPYS.push.activando : COPYS.push.activar}
        </button>
      )}
    </div>
  )
}
