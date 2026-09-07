'use server'

/**
 * Las acciones de servidor que no pasan por la API.
 *
 * Solo elegir y olvidar departamento: no tocan la base ni calculan nada, guardan
 * una preferencia del dispositivo.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { zDpto } from '@/lib/esquemas'
import { COOKIE_DPTO, DURACION_DPTO } from '@/lib/dispositivo'

export async function elegirDepartamento(formData: FormData) {
  const dpto = zDpto.parse(formData.get('dpto'))
  const tarro = await cookies()
  tarro.set(COOKIE_DPTO, dpto, { path: '/', maxAge: DURACION_DPTO, sameSite: 'lax' })
  redirect('/')
}

export async function olvidarDepartamento() {
  const tarro = await cookies()
  tarro.delete(COOKIE_DPTO)
  redirect('/')
}
