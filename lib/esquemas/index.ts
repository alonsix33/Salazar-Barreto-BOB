/** Los esquemas de cada endpoint. Comparte tipos con el cliente. */

import { z } from 'zod'
import { zDpto, zLectura, zM3, zM3Recibo, zMes, zMonto, zPin, zTexto } from './comunes'

export * from './comunes'

/**
 * La versión del cierre que el cliente tenía. **Obligatoria** en todo lo que
 * escribe sobre un mes.
 *
 * Era opcional, y eso convertía el bloqueo optimista en decorado: `tomarVersion`
 * no comprueba nada cuando le llega `undefined`, así que cualquier cliente que
 * omitiera el campo —o cualquier esquema que se olvidara de declararlo, como le
 * pasaba a `gastos-fijos`— se saltaba el bloqueo entero y pisaba la pestaña de
 * al lado sin ruido. Un candado que se abre si no pides la llave no es un
 * candado.
 */
export const zVersion = z.number().int().nonnegative()

/** `PUT /api/meses/[mes]/lecturas` · guardar lecturas, parcial. */
export const zGuardarLecturas = z.object({
  lecturas: z.record(zDpto, zLectura).refine((r) => Object.keys(r).length > 0, {
    message: 'No hay ninguna lectura que guardar',
  }),
  /** Bloqueo optimista: la versión del cierre que el cliente tenía. */
  version: zVersion,
})

/** `PUT /api/meses/[mes]/recibo` · guardar el recibo, parcial. */
export const zGuardarRecibo = z
  .object({
    aguaM3: zM3Recibo.optional(),
    aguaMonto: zMonto.optional(),
    luz: zMonto.optional(),
    /** `null` borra el descuento; omitirlo lo deja como estaba. */
    descuento: zMonto.nullable().optional(),
    version: zVersion,
  })
  .refine((r) => r.aguaM3 !== undefined || r.aguaMonto !== undefined || r.luz !== undefined || r.descuento !== undefined, {
    message: 'No hay ningún dato del recibo que guardar',
  })

/** `PUT /api/meses/[mes]/gastos` · gastos extraordinarios y créditos. */
export const zGuardarGastos = z.object({
  extras: z
    .array(
      z.discriminatedUnion('tipo', [
        z.object({
          tipo: z.literal('gasto'),
          concepto: zTexto(80).min(1, 'El gasto necesita un concepto'),
          monto: zMonto,
        }),
        z.object({
          tipo: z.literal('credito'),
          concepto: zTexto(80).default('Crédito'),
          monto: zMonto,
          // Un crédito sin departamento se evapora: no se le resta a nadie y el
          // mes cuadra igual. Por eso aquí es obligatorio, y además hay un CHECK
          // en la base.
          dpto: zDpto,
        }),
      ]),
    )
    .max(50, 'Demasiados gastos puntuales en un mes'),
  version: zVersion,
})

/** `PUT /api/meses/[mes]/reasignaciones` · la casilla del lavado. */
export const zGuardarReasignaciones = z.object({
  activa: z.boolean(),
  version: zVersion,
})

/** `POST /api/meses/[mes]/publicar` · el paso 7. */
export const zPublicar = z.object({
  notaQuePaso: zTexto(1000),
  notaQueCambio: zTexto(1000),
  notaQuePendiente: zTexto(1000),
  version: zVersion,
})

/** `POST /api/meses/[mes]/corregir` · corregir un mes ya publicado. */
export const zCorregir = z.object({
  lecturas: z.record(zDpto, zLectura).optional(),
  recibo: z
    .object({
      aguaM3: zM3Recibo.optional(),
      aguaMonto: zMonto.optional(),
      luz: zMonto.optional(),
      descuento: zMonto.nullable().optional(),
    })
    .optional(),
  motivo: zTexto(500).min(1, 'Di qué estás corrigiendo: el aviso a los siete lo lleva'),
  /**
   * También aquí. Dos correcciones simultáneas del mismo mes salían las dos
   * bien, y los dos avisos a los siete citaban el mismo «pasó de S/ …» —cierto
   * solo para la primera—.
   */
  version: zVersion,
})

/** `POST /api/pagos/aviso` · el vecino dice "ya pagué". */
export const zAvisoPago = z.object({
  mes: zMes,
  dpto: zDpto,
  texto: zTexto(300).optional(),
  operacion: zTexto(40).optional(),
})

/** `POST /api/pagos/confirmar` · el admin confirma contra el banco. */
export const zConfirmarPago = z.object({
  mes: zMes,
  dpto: zDpto,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va en AAAA-MM-DD').optional(),
  operacion: zTexto(40).optional(),
  // Cuánto entró de verdad. Omitido = pagó justo su cuota. Si difiere, la
  // diferencia queda a favor o pendiente del departamento.
  monto: zMonto.optional(),
})

/** `PUT /api/gastos-fijos` · editar montos, con su vigencia. */
export const zGuardarGastosFijos = z.object({
  cambios: z
    .array(
      z.object({
        concepto: zTexto(80).min(1),
        /** `null` es "por confirmar", que no es lo mismo que 0. */
        monto: zMonto.nullable(),
        anual: z.boolean().optional(),
      }),
    )
    .min(1, 'No hay ningún cambio')
    .max(30),
  /** Desde qué mes aplica. Un cambio no reescribe el pasado. */
  vigenteDesde: zMes,
})

/** `PUT /api/reasignaciones` · cambiar los m³ del lavado. */
export const zConfigurarLavado = z.object({
  m3: zM3,
})

/** `POST /api/avisos/leer` */
export const zMarcarLeidos = z.object({
  dpto: zDpto,
  avisos: z.array(z.string().min(1).max(40)).max(200).optional(),
})

/** `POST /api/push/suscribir` · guardar la suscripción de un dispositivo. */
export const zSuscribirPush = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  dpto: zDpto.optional(),
})

/** `POST /api/push/desuscribir` */
export const zDesuscribirPush = z.object({
  endpoint: z.string().url().max(2000),
})

/** `POST /api/admin/pin` */
export const zValidarPin = z.object({ pin: zPin })

/** `POST /api/bob` */
export const zPreguntaBob = z.object({
  pregunta: zTexto(500).min(1, 'Escribe una pregunta'),
  dpto: zDpto.optional(),
  mes: zMes.optional(),
})

/**
 * En la petición HTTP la versión es **obligatoria**; para quien llama al
 * servicio directamente —la semilla, los tests, `cargarMesEnCurso`— es
 * opcional, porque ahí no hay dos pestañas que puedan pisarse.
 *
 * La distinción es a propósito: el candado se exige en la puerta, que es por
 * donde entra el navegador, y no estorba dentro de casa.
 */
type SinVersionObligatoria<T extends { version: number }> = Omit<T, 'version'> & {
  version?: number
}

export type GuardarLecturas = SinVersionObligatoria<z.infer<typeof zGuardarLecturas>>
export type GuardarRecibo = SinVersionObligatoria<z.infer<typeof zGuardarRecibo>>
export type GuardarGastos = SinVersionObligatoria<z.infer<typeof zGuardarGastos>>
export type Publicar = SinVersionObligatoria<z.infer<typeof zPublicar>>
export type Corregir = SinVersionObligatoria<z.infer<typeof zCorregir>>
export type AvisoPago = z.infer<typeof zAvisoPago>
export type ConfirmarPago = z.infer<typeof zConfirmarPago>
export type GuardarGastosFijos = z.infer<typeof zGuardarGastosFijos>
export type PreguntaBob = z.infer<typeof zPreguntaBob>
