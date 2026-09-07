import { NextResponse } from 'next/server'
import { COOKIE_ADMIN, limpiarIntentos, validarPin } from '@/lib/servicios/admin'
import { ErrorDeApi } from '@/lib/servicios/errores'
import { zValidarPin } from '@/lib/esquemas'
import { ipDeLaPeticion, leerCuerpo } from '@/lib/servicios/ruta'

/**
 * `POST /api/admin/pin` · valida el PIN y devuelve una sesión corta.
 *
 * El PIN vive en `ADMIN_PIN`, variable de entorno del **servidor**. Nunca entra
 * en el bundle del cliente. Hay límite de intentos por IP.
 *
 * No usa `responder()` porque tiene que poner una cookie.
 */
export async function POST(peticion: Request) {
  try {
    const { pin } = await leerCuerpo(peticion, zValidarPin)
    const ip = await ipDeLaPeticion()
    const { cookie, expira } = await validarPin(pin, ip)
    void limpiarIntentos().catch(() => {})

    const respuesta = NextResponse.json({ ok: true, expira: expira.toISOString() })
    respuesta.cookies.set(COOKIE_ADMIN, cookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expira,
    })
    return respuesta
  } catch (e) {
    if (e instanceof ErrorDeApi) {
      return NextResponse.json({ error: e.message }, { status: e.estado })
    }
    console.error('[api/admin/pin]', e)
    return NextResponse.json({ error: 'Algo salió mal de nuestro lado.' }, { status: 500 })
  }
}

/** `DELETE /api/admin/pin` · salir de administración. */
export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true })
  respuesta.cookies.set(COOKIE_ADMIN, '', { path: '/', expires: new Date(0) })
  return respuesta
}
