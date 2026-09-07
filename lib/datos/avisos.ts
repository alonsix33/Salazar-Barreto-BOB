/**
 * Los avisos y su estado de lectura.
 *
 * Los siete ven lo mismo: no hay avisos privados. Lo único que es por
 * departamento es si ya lo leíste, que solo sirve para apagar el punto de la
 * campana.
 */

import { prisma } from './prisma'
import type { DptoId } from '@/lib/calculo/tipos'
import type { TipoAviso } from '@prisma/client'

export interface AvisoVisto {
  id: string
  tipo: TipoAviso
  titulo: string
  detalle: string
  mes: string | null
  creadoEn: string
  leido: boolean
}

const MAXIMO = 100

/** Los avisos, del más nuevo al más viejo, con si este departamento los leyó. */
export async function avisosPara(dpto: DptoId): Promise<AvisoVisto[]> {
  const filas = await prisma.aviso.findMany({
    orderBy: { creadoEn: 'desc' },
    take: MAXIMO,
    include: { leidoPor: { where: { dptoId: dpto } } },
  })
  return filas.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    titulo: a.titulo,
    detalle: a.detalle,
    mes: a.mes,
    creadoEn: a.creadoEn.toISOString(),
    leido: a.leidoPor.length > 0,
  }))
}

/** Cuántos no ha leído: es lo que enciende el punto de la campana. */
export async function sinLeer(dpto: DptoId): Promise<number> {
  const total = await prisma.aviso.count()
  const leidos = await prisma.avisoLeido.count({ where: { dptoId: dpto } })
  return Math.max(0, total - leidos)
}

/** Marca leídos. Sin lista, marca todos: es "Marcar todo leído". */
export async function marcarLeidos(dpto: DptoId, ids?: readonly string[]) {
  const objetivo = ids?.length
    ? ids
    : (await prisma.aviso.findMany({ select: { id: true }, take: MAXIMO, orderBy: { creadoEn: 'desc' } })).map(
        (a) => a.id,
      )
  await prisma.avisoLeido.createMany({
    data: objetivo.map((avisoId) => ({ avisoId, dptoId: dpto })),
    skipDuplicates: true,
  })
  return { leidos: objetivo.length, sinLeer: await sinLeer(dpto) }
}
