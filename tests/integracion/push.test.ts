/**
 * El envío de push manda a los suscritos y limpia las suscripciones muertas.
 *
 * La entrega real solo se prueba desplegada (HTTPS + servicio de push). Aquí se
 * prueba la lógica del servidor con `web-push` simulado: sin claves es no-op; con
 * claves manda a cada uno; y una suscripción caída (410) se borra sola.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendNotification = vi.fn()
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}))

import { enviarPushATodos, guardarSuscripcion } from '@/lib/push'
import { prisma, resembrar } from './entorno'

const AVISO = { titulo: 'x', cuerpo: 'y', url: '/' }

async function sembrarSubs() {
  await guardarSuscripcion({ endpoint: 'https://push.example/a', p256dh: 'ka', auth: 'aa', dpto: '101' })
  await guardarSuscripcion({ endpoint: 'https://push.example/b', p256dh: 'kb', auth: 'ab' })
}

describe('enviarPushATodos', () => {
  beforeEach(async () => {
    await resembrar()
    sendNotification.mockReset()
    vi.unstubAllEnvs()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('sin claves VAPID es un no-op', async () => {
    await sembrarSubs()
    const r = await enviarPushATodos(AVISO)
    expect(r).toEqual({ enviados: 0, caidas: 0 })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('con claves manda a cada suscripción', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    await sembrarSubs()
    sendNotification.mockResolvedValue(undefined)

    const r = await enviarPushATodos(AVISO)
    expect(r.enviados).toBe(2)
    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it('una suscripción caída (410) se borra', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    await sembrarSubs()
    sendNotification.mockImplementation((sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/a')) return Promise.reject({ statusCode: 410 })
      return Promise.resolve(undefined)
    })

    const r = await enviarPushATodos(AVISO)
    expect(r).toEqual({ enviados: 1, caidas: 1 })
    const quedan = await prisma.pushSubscription.findMany()
    expect(quedan.map((s) => s.endpoint)).toEqual(['https://push.example/b'])
  })
})
