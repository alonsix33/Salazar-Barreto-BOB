/**
 * La frontera entre `Decimal` y `number`.
 *
 * La base guarda dinero en `Decimal` con su precisión explícita, nunca en
 * `Float`. El motor de cálculo opera en punto flotante porque **el cuadre
 * depende de dónde cae cada `Math.round`**, y portarlo a decimales cambiaría
 * resultados en el último céntimo (ver `docs/PLAN.md` §4.2).
 *
 * La conversión ocurre **solo aquí**. Si aparece un `.toNumber()` suelto en
 * otro sitio, es un bug: significa que alguien saltó la frontera.
 */

import { Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal

/** `Decimal → number`, comprobando que lo que sale es un número de verdad. */
export function aNumero(d: Decimal | null | undefined): number | null {
  if (d === null || d === undefined) return null
  const n = d.toNumber()
  if (!Number.isFinite(n)) {
    throw new Error(`Un valor de la base no es un número finito: ${d.toString()}`)
  }
  return n
}

/** Igual, pero para columnas que no admiten nulo. */
export function aNumeroObligatorio(d: Decimal): number {
  const n = aNumero(d)
  if (n === null) throw new Error('Se esperaba un número y llegó null')
  return n
}

/** `number → Decimal` con dos decimales. Para montos. */
export function aDecimal2(n: number): Decimal {
  if (!Number.isFinite(n)) throw new Error(`No se puede guardar ${n} como monto`)
  return new Prisma.Decimal(n.toFixed(2))
}

/** `number → Decimal` con tres decimales. Para lecturas de medidor. */
export function aDecimal3(n: number): Decimal {
  if (!Number.isFinite(n)) throw new Error(`No se puede guardar ${n} como lectura`)
  return new Prisma.Decimal(n.toFixed(3))
}
