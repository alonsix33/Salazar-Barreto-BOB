/**
 * Esquemas Zod compartidos entre cliente y servidor.
 *
 * Es el **borde**: nada llega al motor de cálculo ni a la base sin pasar por
 * aquí. El motor tiene sus propios guardianes, pero son defensa en profundidad;
 * la validación de verdad es esta.
 */

import { z } from 'zod'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import type { DptoId } from '@/lib/calculo/tipos'

/** `'2026-07'`. Rechaza `'2026-13'`, `'junio'`, `''`, `'2026-6'`. */
export const zMes = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El mes tiene que ser AAAA-MM, por ejemplo 2026-07')

/** Uno de los siete departamentos. */
export const zDpto = z.enum(DPTO_IDS as unknown as [DptoId, ...DptoId[]])

/**
 * Un monto en soles: finito, no negativo, con dos decimales como mucho.
 *
 * `z.coerce` no: convertir `"1200"` en 1 200 en silencio es cómo un gasto
 * tecleado como cadena acabó desapareciendo del total. Si llega una cadena, se
 * rechaza y el cliente lo arregla.
 */
export const zMonto = z
  .number()
  .finite('Ese monto no es un número')
  .nonnegative('Un monto no puede ser negativo')
  .max(1_000_000, 'Ese monto es demasiado grande, revísalo')
  .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(6)), {
    message: 'Un monto lleva como mucho dos decimales',
  })

/** Una lectura de medidor: finita, no negativa, tres decimales como mucho. */
export const zLectura = z
  .number()
  .finite('Esa lectura no es un número')
  .nonnegative('Una lectura no puede ser negativa')
  .max(1_000_000, 'Esa lectura es demasiado grande, revísala')
  .refine((n) => Math.round(n * 1000) === Number((n * 1000).toFixed(6)), {
    message: 'Una lectura lleva como mucho tres decimales',
  })

/** m³ del recibo de SEDAPAL: entero, no negativo. */
export const zM3Recibo = z
  .number()
  .int('Los m³ del recibo vienen en número entero')
  .nonnegative('Los m³ no pueden ser negativos')
  .max(100_000, 'Esos m³ son demasiados, revísalos')

/** m³ de una reasignación: hasta dos decimales. */
export const zM3 = z
  .number()
  .finite()
  .nonnegative()
  .max(10_000)
  .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(6)), {
    message: 'Los m³ llevan como mucho dos decimales',
  })

/** Un texto que escribe una persona. Se recorta para que no llegue un JSON de 10 MB. */
export const zTexto = (max: number) => z.string().trim().max(max)

/** El PIN de administración: cuatro dígitos. */
export const zPin = z.string().regex(/^\d{4}$/, 'El PIN son cuatro dígitos')
