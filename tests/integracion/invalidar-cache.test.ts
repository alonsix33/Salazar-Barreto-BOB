/**
 * Que **toda escritura tire la caché de lectura**.
 *
 * Esto es lo único que separa «los números están al día» de «el vecino ve una
 * cuota de la semana pasada y se fía de ella». La caché la invalida la extensión
 * de Prisma de `lib/datos/prisma.ts` —el único sitio—, y `responder()` repite la
 * invalidación después del commit.
 *
 * ## Por qué se comprueba aquí y no contra la app levantada
 *
 * Se intentó primero de la forma obvia: levantar `next start`, calentar la
 * caché, escribir por la API y mirar si la pantalla cambiaba. **Ese chequeo daba
 * verde con la invalidación arrancada de raíz.** Medido: con `revalidateTag`
 * sustituido por una función vacía, las cuatro pantallas seguían enseñando lo
 * nuevo. El motivo es que en un `next start` cualquier POST vacía la caché de
 * datos del proceso, así que la prueba pasaba por un camino que no es el que se
 * quiere comprobar —y que en Vercel no existe: allí la caché la comparten varias
 * instancias y solo la etiqueta la tira—.
 *
 * Un chequeo así es peor que no tener ninguno: apaga la sospecha. Así que la
 * invalidación se comprueba donde sí se puede ver —que la llamada ocurre, en
 * cada operación de escritura y en ninguna de lectura— y el de extremo a extremo
 * se queda en lo que sí prueba: que después de escribir, los números están al
 * día.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const invalidadas: string[] = []
vi.mock('next/cache', () => ({
  revalidateTag: (etiqueta: string) => {
    invalidadas.push(etiqueta)
  },
  unstable_cache: <T>(fn: T) => fn,
}))

const { prisma, resembrar } = await import('./entorno')
const { TAG_EDIFICIO } = await import('@/lib/datos/etiquetas')
const { ESCRITURAS } = await import('@/lib/datos/prisma')

beforeAll(async () => {
  await resembrar()
}, 60_000)

afterEach(() => {
  invalidadas.length = 0
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('cada escritura invalida la caché del edificio', () => {
  it('un `update` la invalida', async () => {
    const r = await prisma.recibo.findFirst()
    expect(r).not.toBeNull()
    invalidadas.length = 0
    await prisma.recibo.update({ where: { id: r!.id }, data: { luz: r!.luz } })
    expect(invalidadas).toContain(TAG_EDIFICIO)
  })

  it('un `create` y un `delete` la invalidan', async () => {
    const creado = await prisma.aviso.create({
      data: { tipo: 'recordatorio', titulo: 'prueba de invalidación', detalle: 'se borra abajo' },
    })
    expect(invalidadas).toContain(TAG_EDIFICIO)
    invalidadas.length = 0
    await prisma.aviso.delete({ where: { id: creado.id } })
    expect(invalidadas).toContain(TAG_EDIFICIO)
  })

  it('un `upsert` la invalida', async () => {
    const a = await prisma.aviso.create({ data: { tipo: 'recordatorio', titulo: 'upsert', detalle: 'x' } })
    invalidadas.length = 0
    await prisma.aviso.upsert({
      where: { id: a.id },
      create: { tipo: 'recordatorio', titulo: 'upsert', detalle: 'x' },
      update: { detalle: 'y' },
    })
    expect(invalidadas).toContain(TAG_EDIFICIO)
    await prisma.aviso.delete({ where: { id: a.id } })
  })

  it('una LECTURA no la invalida · si no, la caché no serviría de nada', async () => {
    await prisma.recibo.findMany()
    await prisma.pago.count()
    await prisma.cierre.findFirst()
    expect(invalidadas).toEqual([])
  })

  it('las escrituras dentro de una transacción también la invalidan', async () => {
    await prisma.$transaction(async (tx) => {
      const a = await tx.aviso.create({ data: { tipo: 'recordatorio', titulo: 'en tx', detalle: 'x' } })
      await tx.aviso.delete({ where: { id: a.id } })
    })
    expect(invalidadas).toContain(TAG_EDIFICIO)
  })
})

describe('la lista de operaciones de escritura está completa', () => {
  /**
   * Las operaciones de Prisma que **leen**. Todo lo demás que exponga el cliente
   * tiene que estar en `ESCRITURAS`.
   *
   * Se comprueba contra el cliente de verdad, no contra una lista escrita a
   * mano, para que el día que Prisma añada una operación este test se ponga rojo
   * y haya que decidir de qué lado va. Una operación de escritura nueva que se
   * colara sin más dejaría la caché vieja en silencio, que es el fallo que no se
   * ve hasta que un vecino pregunta por qué su cuota no cuadra.
   */
  const LECTURAS = new Set([
    'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
    'count', 'aggregate', 'groupBy', 'fields',
    // Solo existen en MongoDB. Aquí no se usan, pero el cliente las expone.
    'findRaw', 'aggregateRaw',
  ])
  /** No son operaciones: son propiedades del delegado. */
  const NO_SON_OPERACIONES = new Set(['name'])

  it('ninguna operación del cliente se queda sin clasificar', () => {
    const delCliente = Object.keys(prisma.recibo).filter((k) => !k.startsWith('$') && !k.startsWith('_'))
    expect(delCliente.length).toBeGreaterThan(8)
    const sinClasificar = delCliente.filter(
      (op) => !LECTURAS.has(op) && !ESCRITURAS.has(op) && !NO_SON_OPERACIONES.has(op),
    )
    expect(sinClasificar).toEqual([])
  })

  it('y ninguna lectura se coló en la lista de escrituras', () => {
    expect([...ESCRITURAS].filter((op) => LECTURAS.has(op as string))).toEqual([])
  })
})
