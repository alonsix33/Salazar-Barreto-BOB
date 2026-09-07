/**
 * Utilidades para los tests de integración.
 *
 * Cada archivo de test **resiembra la base desde cero**: un test que depende de
 * lo que dejó otro es un test que pasa hasta que alguien cambia el orden.
 */

import { execFileSync } from 'node:child_process'
import { tomarCerrojo } from '../cerrojo'
import { prisma } from '@/lib/datos/prisma'

export function exigirBaseDeDatos(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Los tests de integración necesitan DATABASE_URL. Levanta una base y vuelve a correrlos.',
    )
  }
}

/** Deja la base en el estado exacto de la semilla. */
export async function resembrar(): Promise<void> {
  exigirBaseDeDatos()
  /**
   * El mismo cerrojo que usa la suite de pantalla.
   *
   * La base es una sola y la comparten las dos suites, las pruebas negativas y
   * cualquier `next dev` abierto. Sin esto, un `resembrar()` de aquí y otro de
   * allá se solapaban: se vio reventar el borrado de departamentos porque otro
   * proceso insertó un pago en medio, y el rojo salía en el fichero inocente.
   *
   * **Se toma y NO se suelta hasta que el proceso termina.**
   *
   * Soltarlo justo después de resembrar dejaba una ventana del tamaño del test:
   * otro proceso resembraba por debajo mientras este comprobaba sus cifras, y
   * salían cuatro rojos que no eran del producto —medido, y en la corrida
   * siguiente los mismos tests pasaron sin tocar nada—. Un rojo que aparece y
   * desaparece es peor que uno fijo: enseña a no fiarse de la suite.
   *
   * El cerrojo es re-entrante, así que los `beforeEach` que llaman aquí una y
   * otra vez no se bloquean, y el manejador de `exit` de `tests/cerrojo.ts` lo
   * suelta pase lo que pase.
   */
  await tomarCerrojo(120_000)
  await borrarYSembrar()
}

async function borrarYSembrar(): Promise<void> {
  // El orden importa por las claves foráneas.
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

  execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
    stdio: 'pipe',
    env: process.env,
    cwd: new URL('../..', import.meta.url).pathname,
  })
}

/**
 * Escribe en el mes en curso lo que el administrador teclearía en el cierre.
 *
 * La semilla lo deja vacío a propósito —sus lecturas y su recibo son justo lo
 * que se va a teclear—, así que los tests que necesitan un mes completo lo
 * llenan aquí, por los mismos endpoints que usa la interfaz.
 */
export async function cargarMesEnCurso(mes = '2026-07'): Promise<void> {
  const { guardarLecturas, guardarRecibo } = await import('@/lib/servicios/cierre')
  const { LECTURAS, RECIBOS } = await import('@/lib/semilla')
  const lecturas = LECTURAS[mes]
  const recibo = RECIBOS[mes]
  if (!lecturas || !recibo) throw new Error(`La semilla no tiene datos de ${mes}`)
  await guardarLecturas(mes, { lecturas: lecturas as Record<string, number> })
  await guardarRecibo(mes, {
    aguaM3: recibo.aguaM3,
    aguaMonto: recibo.aguaMonto,
    luz: recibo.luz,
    descuento: recibo.descuento ?? null,
  })
}

export { prisma }
