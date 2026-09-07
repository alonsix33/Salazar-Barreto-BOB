/**
 * El cliente de Prisma, uno solo.
 *
 * En desarrollo Next recarga los módulos en caliente y cada recarga crearía un
 * cliente nuevo, hasta agotar las conexiones del pool.
 */

import { PrismaClient } from '@prisma/client'

const global_ = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  global_.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') global_.prisma = prisma

export type { Prisma } from '@prisma/client'
