/**
 * Los tipos de Bob. `05-bob-agente.md`.
 *
 * La interfaz es **la misma en los dos modos**: `determinista` responde con el
 * catálogo escrito a mano, sin clave y sin coste; `deepseek` usa el modelo. Nada
 * de arriba —la hoja, la ruta— sabe cuál está en marcha, y eso es a propósito:
 * enchufar la clave no puede cambiar lo que la app espera de vuelta.
 */

import type { DptoId, MesId } from '@/lib/calculo/tipos'

/** Lo que Bob necesita saber para responder: quién pregunta y sobre qué mes. */
export interface Contexto {
  /** El departamento de quien pregunta. Bob no ve los de los demás por defecto. */
  dpto: DptoId | null
  /** El mes que se está mirando. No el mes actual del sistema. */
  mes: MesId
  /** `true` si quien pregunta tiene sesión de administración abierta. */
  esAdmin: boolean
}

export interface Pregunta {
  texto: string
  contexto: Contexto
}

/**
 * Un turno anterior de la misma conversación.
 *
 * **Viene del navegador**, y hay que tratarlo como lo que es: texto de fuera.
 * No cambia lo que Bob puede leer ni lo que puede escribir, y sobre todo no
 * amplía las cifras permitidas —esas salen solo de las herramientas—, así que
 * lo peor que puede hacer alguien manipulándolo es que Bob le conteste una
 * rareza **a él mismo**. Aun así va acotado en cantidad y en tamaño.
 */
export interface Turno {
  de: 'vecino' | 'bob'
  texto: string
}

/** Cuántos turnos anteriores se mandan, y cuánto ocupa cada uno. */
export const MAX_TURNOS = 6
export const MAX_TURNO = 600

/**
 * Una llamada a herramienta, con lo que devolvió.
 *
 * Se guarda entera —nombre, argumentos y resultado— porque de aquí sale la
 * **verificación de números**: toda cifra de la respuesta tiene que existir en
 * el resultado de alguna de estas llamadas.
 */
export interface Llamada {
  herramienta: string
  argumentos: Record<string, unknown>
  resultado: unknown
  ms: number
}

export interface Respuesta {
  /** Lo que se le enseña al vecino. Dos frases como mucho. */
  texto: string
  /**
   * A qué pantalla lleva la respuesta, si lleva a alguna.
   *
   * `05` §3: **cada respuesta enlaza a la pantalla que la demuestra.** Es la
   * versión de Bob del «nada de confía en mí».
   */
  lleva: { hoja: 'calculo' | 'agua' | 'pagos' | 'pagar'; etiqueta: string } | null
  /** Con qué se respondió, para poder auditarlo. */
  modo: 'determinista' | 'deepseek'
  /**
   * Por qué se cayó al determinista, si se cayó.
   *
   * `null` cuando no hubo caída. Se guarda en el registro: si el modelo empieza a
   * inventar cifras, esto es lo que lo enseña.
   */
  motivoCaida: MotivoCaida | null
  llamadas: Llamada[]
}

/** Las razones por las que una respuesta del modelo se descarta. */
export type MotivoCaida =
  | 'sin-clave'
  | 'tiempo-agotado'
  | 'error-del-modelo'
  | 'numero-inventado'
  | 'respuesta-vacia'

/** Una herramienta: lo que Bob puede llamar. Nunca escribe. */
export interface Herramienta<A = Record<string, unknown>, R = unknown> {
  nombre: string
  /** Para el prompt del modelo. Una línea. */
  descripcion: string
  /** El esquema de los argumentos, en JSON Schema, para el modelo. */
  parametros: Record<string, unknown>
  ejecutar: (argumentos: A, contexto: Contexto) => Promise<R>
}
