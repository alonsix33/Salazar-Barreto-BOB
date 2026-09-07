/**
 * Notificaciones push del navegador. `06` §9.6.7.
 *
 * Solo servidor: la clave **privada** de VAPID vive aquí y **nunca** en el
 * bundle del cliente. El cliente solo conoce la pública (`NEXT_PUBLIC_…`), que no
 * es secreta.
 *
 * Sin claves configuradas, todo esto es un no-op silencioso: en desarrollo y en
 * los tests no hay push, y la app funciona igual (el aviso de WhatsApp cubre el
 * caso). El push se prueba de verdad **desplegado**, con HTTPS y claves reales.
 */
import webpush from 'web-push'
import { prisma } from './datos/prisma'

// El env se lee **dentro** de las funciones, no al cargar el módulo: así el
// valor es el de runtime (y los tests pueden fijarlo sin importar en un orden raro).
const claves = () => ({
  publica: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  privada: process.env.VAPID_PRIVATE_KEY ?? '',
  sujeto: process.env.VAPID_SUBJECT || 'mailto:administracion@salazar-barreto.pe',
})

function configurar(): boolean {
  const { publica, privada, sujeto } = claves()
  if (!publica || !privada) return false
  webpush.setVapidDetails(sujeto, publica, privada)
  return true
}

/** `true` si hay claves para mandar push. La UI la usa para no ofrecer algo muerto. */
export function pushConfigurado(): boolean {
  const { publica, privada } = claves()
  return !!(publica && privada)
}

/** Guarda (o actualiza) la suscripción de un dispositivo. Única por `endpoint`. */
export async function guardarSuscripcion(datos: {
  endpoint: string
  p256dh: string
  auth: string
  dpto?: string | null
}): Promise<{ ok: true }> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: datos.endpoint },
    create: { endpoint: datos.endpoint, p256dh: datos.p256dh, auth: datos.auth, dptoId: datos.dpto ?? null },
    update: { p256dh: datos.p256dh, auth: datos.auth, dptoId: datos.dpto ?? null },
  })
  return { ok: true }
}

/** Borra la suscripción de un dispositivo (el vecino apagó los avisos). */
export async function borrarSuscripcion(endpoint: string): Promise<{ ok: true }> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return { ok: true }
}

export interface AvisoPush {
  titulo: string
  cuerpo: string
  /** A dónde lleva el toque en la notificación. */
  url: string
}

/**
 * Manda un push a **todos** los dispositivos suscritos. Fire-and-forget: nunca
 * lanza —un fallo de push no puede tumbar una publicación—, y borra sola las
 * suscripciones muertas (el navegador las revoca y el envío da 404/410).
 */
export async function enviarPushATodos(aviso: AvisoPush): Promise<{ enviados: number; caidas: number }> {
  if (!configurar()) return { enviados: 0, caidas: 0 }
  const subs = await prisma.pushSubscription.findMany()
  const carga = JSON.stringify(aviso)
  let enviados = 0
  let caidas = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          carga,
        )
        enviados++
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          caidas++
          await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {})
        }
      }
    }),
  )
  return { enviados, caidas }
}
