import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '@/lib/datos/prisma'
import { exigirAdmin } from '@/lib/servicios/ruta'

const ejecutar = promisify(execFile)

/**
 * `POST /api/pruebas/resembrar` · deja la base como la semilla.
 *
 * **Dos cerrojos, y hacen falta los dos.**
 *
 * 1. Solo existe fuera de producción: allí devuelve 404, igual que cualquier
 *    ruta que no existe.
 * 2. Y pide PIN de administración.
 *
 * El segundo faltaba, y el primero solo no bastaba: cualquier despliegue de
 * previsualización, cualquier `next dev` en la wifi de casa y cualquier entorno
 * con `PERMITIR_RESEMBRADO=si` era un borrado completo de la base con un `curl`
 * de una línea, sin credencial ninguna. Medido: `curl -X POST` sin cookie
 * devolvía `200 {"ok":true}` con la base vacía detrás.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.PERMITIR_RESEMBRADO !== 'si') {
    return new Response('Not Found', { status: 404 })
  }
  // Lanza 401 si no hay sesión de administración. Es la misma puerta que el
  // resto de escrituras: una ruta que borra la base no puede pedir menos.
  await exigirAdmin()

  await prisma.avisoLeido.deleteMany()
  await prisma.aviso.deleteMany()
  await prisma.auditoria.deleteMany()
  await prisma.intentoPin.deleteMany()
  await prisma.reasignacionActivaEnMes.deleteMany()
  await prisma.reasignacionAgua.deleteMany()
  await prisma.gastoExtra.deleteMany()
  await prisma.gastoFijo.deleteMany()
  await prisma.pago.deleteMany()
  await prisma.lectura.deleteMany()
  await prisma.recibo.deleteMany()
  await prisma.cierre.deleteMany()
  await prisma.departamento.deleteMany()
  await prisma.configuracionEdificio.deleteMany()

  await ejecutar('npx', ['tsx', 'prisma/seed.ts'], { env: process.env })
  return Response.json({ ok: true })
}
