/**
 * El cliente de Prisma, uno solo.
 *
 * En desarrollo Next recarga los módulos en caliente y cada recarga crearía un
 * cliente nuevo, hasta agotar las conexiones del pool.
 *
 * Y, sobre todo: **toda escritura invalida la caché de lectura**. La extensión
 * de abajo es el único sitio donde eso ocurre, a propósito. La alternativa era
 * poner un `revalidateTag` al final de cada servicio, y basta olvidarlo en uno
 * —o escribir un servicio nuevo el mes que viene— para que un vecino vea una
 * cuota vieja sin que nada se ponga rojo. Aquí no hay nada que recordar: si el
 * dato pasó por Prisma y era una escritura, la caché se tira.
 */

import { PrismaClient } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import { contarEscritura, TAG_EDIFICIO } from './etiquetas'

/**
 * Las operaciones de Prisma que cambian datos.
 *
 * Están enumeradas en positivo —no «todo lo que no sea `find`»— para que una
 * operación nueva de Prisma no entre por descuido. El chequeo de que la lista
 * está completa es un test: recorre las operaciones del cliente y comprueba que
 * ninguna que escriba se quedó fuera.
 */
export const ESCRITURAS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/**
 * Avisa de que la foto del edificio quedó vieja.
 *
 * `revalidateTag` solo existe dentro de una petición de Next. En un script de
 * siembra, en los tests o en la consola de Prisma no hay nada que invalidar
 * —tampoco hay caché—, así que el fallo se traga a propósito. El contador, en
 * cambio, sube siempre: es lo que lee `responder()`.
 */
function seEscribio(): void {
  contarEscritura()
  try {
    revalidateTag(TAG_EDIFICIO)
  } catch {
    // Fuera de una petición de Next no hay caché que tirar.
  }
}

function crear() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const salida = await query(args)
          if (ESCRITURAS.has(operation)) seEscribio()
          return salida
        },
      },
    },
  })
}

type Cliente = ReturnType<typeof crear>

const global_ = globalThis as unknown as { prisma?: Cliente }

export const prisma: Cliente = global_.prisma ?? crear()

if (process.env.NODE_ENV !== 'production') global_.prisma = prisma

export type { Prisma } from '@prisma/client'

/**
 * El cliente de dentro de una transacción.
 *
 * Ya no vale `Prisma.TransactionClient`: la extensión de arriba cambia el tipo
 * del cliente, y el que llega al callback de `$transaction` es el extendido sin
 * los métodos que no tienen sentido dentro de una transacción. Se deriva del
 * cliente real para que no se puedan separar.
 */
export type Tx = Omit<
  Cliente,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
