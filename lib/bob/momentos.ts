/**
 * Los sitios donde Bob habla **sin que nadie le pregunte**.
 *
 * ## Por qué existe este fichero
 *
 * Porque hasta ahora cada uno de estos textos vivía dentro de su componente, y
 * eso tenía dos consecuencias feas. La primera es que no había forma de saber
 * de un vistazo cuándo habla Bob, qué dice y por qué: había que leer siete
 * ficheros. La segunda es que ninguno pasaba por DeepSeek, así que con la clave
 * puesta la app tenía dos Bobs: el de la hoja, que redacta, y el de las
 * pantallas, que recita. El vecino no tiene por qué notar la diferencia.
 *
 * Aquí están los siete, cada uno con:
 *
 *  - **`cuando`**: la condición exacta que lo dispara. Es documentación, sí,
 *    pero también lo que se audita: un momento que se dispara siempre no es un
 *    aviso, es decoración.
 *  - **`determinista`**: lo que se dice sin modelo. Es lo que se pinta en el
 *    servidor y lo que se ve si DeepSeek tarda, falla o inventa una cifra.
 *    **Nunca es un texto de relleno**: es la respuesta buena.
 *  - **`pregunta`**: lo que se le manda al modelo para que lo diga a su manera.
 *
 * ## La regla que no se negocia
 *
 * El determinista se pinta **primero y siempre**. El modelo solo puede
 * *sustituirlo*, nunca retrasarlo: no hay estado de carga, no hay hueco que se
 * llene después, no hay salto de maquetación. Si DeepSeek no contesta, no pasa
 * nada, porque lo que había ya era correcto.
 *
 * Y los números del modelo se verifican contra `datos`, igual que los de la
 * hoja se verifican contra las llamadas a herramienta. Son la misma guarda: los
 * `datos` de un momento se le pasan como si fueran el resultado de una
 * herramienta, porque para el caso lo son.
 */

import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { capitalizar } from '@/lib/formato'

/** Los siete. El identificador viaja al servidor, así que es un literal cerrado. */
export type MomentoId =
  | 'inicio-pagos'
  | 'mi-consumo'
  | 'cierre-consumo-alto'
  | 'cierre-agua'
  | 'cierre-luz'
  | 'cierre-sin-cifra'
  | 'cierre-propuesta'

/** Los datos de un momento: lo que se sabe cuando Bob abre la boca. */
export type DatosMomento = Record<string, unknown>

export interface Momento {
  id: MomentoId
  /** En qué pantalla aparece, para la auditoría. */
  donde: string
  /** La condición exacta que lo dispara. Si es «siempre», se dice «siempre». */
  cuando: string
  /** Lo que se pinta en el servidor, y el suelo si el modelo falla. */
  determinista: (d: DatosMomento) => string
  /** Lo que se le pide al modelo. Sin cifras: las cifras van en `datos`. */
  pregunta: (d: DatosMomento) => string
  /**
   * `false` si este momento **no** se le pasa al modelo.
   *
   * Es un campo y no una lista aparte porque una lista aparte se olvida: al
   * agregar el octavo momento, lo que se ve al escribirlo es esta línea.
   */
  mejorable: boolean
}

const n = (d: DatosMomento, k: string): number => Number(d[k] ?? 0)
const s = (d: DatosMomento, k: string): string => String(d[k] ?? '')
const lista = (d: DatosMomento, k: string): string[] => (Array.isArray(d[k]) ? (d[k] as string[]) : [])

/**
 * Los meses anteriores, escritos como los lee una persona.
 *
 * `[{mes:'junio', valor:78}]` → `«junio 78»`. El separador es «y» y no una coma
 * cuando son dos, que es el caso normal.
 */
function anteriores(d: DatosMomento, unidad: string): string {
  const filas = (d.anteriores ?? []) as { mes: string; valor: number }[]
  return filas.map((a) => `${a.mes} ${unidad === 'S/' ? `S/ ${fmt(a.valor)}` : a.valor}`).join(' y ')
}

export const MOMENTOS: Record<MomentoId, Momento> = {
  /**
   * La línea de Bob en Inicio. `05` §4.
   *
   * Se dispara **siempre**, y por eso lo que dice tiene que valer siempre: es
   * lo primero que se lee al abrir la app. Reporta lo bueno también, que es la
   * regla de `05` §3 que más se olvida.
   */
  'inicio-pagos': {
    id: 'inicio-pagos',
    donde: 'Inicio, debajo de la tarjeta de la cuota',
    cuando: 'siempre, con el mes que se está mirando',
    determinista: (d) => {
      const sin = lista(d, 'sinRegistrar')
      const avisados = lista(d, 'avisados')
      const mes = s(d, 'nombreMes')
      if (sin.length === 0 && avisados.length === 0) {
        return `${capitalizar(mes)} cerró completo: los siete al día.`
      }
      if (sin.length === 0) return `Va bien: solo falta confirmar el pago del ${avisados[0]}.`
      if (sin.length === 1) return `Falta que el ${sin[0]} avise.`
      return `Falta que ${sin.length} departamentos avisen.`
    },
    pregunta: (d) =>
      `Resume en una frase cómo va ${s(d, 'nombreMes')} en pagos, con los datos que te doy. ` +
      `Si no falta nadie, dilo como una buena noticia. Si falta alguien, dilo sin señalarlo.`,
    mejorable: true,
  },

  /**
   * El consumo propio, en Mi departamento.
   *
   * Con menos de tres meses **no compara**: un promedio de dos meses no es un
   * promedio, y decir «es tu mes más alto» sobre dos datos es ruido con forma
   * de dato.
   */
  'mi-consumo': {
    id: 'mi-consumo',
    donde: 'Mi departamento, bajo la tira del año',
    cuando: 'siempre; con menos de tres meses medidos dice que aún no hay patrón',
    determinista: (d) => {
      if (n(d, 'mesesConConsumo') < 3) return 'Todavía no tengo suficientes meses para ver un patrón.'
      const m3 = n(d, 'm3')
      const promedio = n(d, 'promedio')
      if (m3 > promedio * 1.2) return `Es tu mes más alto del año, ${fmt(m3 - promedio)} m³ sobre tu promedio.`
      if (m3 < promedio * 0.8) return 'Este mes consumiste bastante menos de lo habitual.'
      return 'Tu consumo está estable, cerca de tu promedio de siempre.'
    },
    pregunta: () =>
      'Di en una frase cómo va el consumo de agua de este departamento respecto a su promedio del año, ' +
      'con los datos que te doy. Sin alarmar y sin felicitar.',
    mejorable: true,
  },

  /**
   * Consumo alto de un departamento, en el paso 1 del cierre.
   *
   * Se dispara **por departamento** cuando pasa del doble de su promedio. No
   * bloquea nada: `04` §4 dice que Bob acompaña, y el que decide es quien
   * administra.
   */
  'cierre-consumo-alto': {
    id: 'cierre-consumo-alto',
    donde: 'Cierre, paso 1, debajo de la lectura',
    cuando: 'cuando el consumo de un departamento pasa del doble de su promedio',
    // El texto sale de `COPYS`, que es donde está transcrito del mockup. Aquí
    // solo se dice cuándo aparece, no se reescribe.
    determinista: (d) => COPYS.cierre.consumoAlto(s(d, 'dpto')),
    pregunta: (d) =>
      `Avisa en una frase de que el consumo del ${s(d, 'dpto')} se salió de lo normal y de que conviene ` +
      `revisar la lectura antes de seguir. Es un aviso, no una acusación, y no bloquea nada.`,
    mejorable: true,
  },

  /**
   * Los m³ del recibo, en el paso 2. `04` §Paso 2 pide que **compare**.
   *
   * Sin meses anteriores se calla la comparación en vez de inventarla. El
   * umbral es 15 %: por debajo, la variación mensual del edificio es normal, y
   * avisar de todo es no avisar de nada.
   */
  'cierre-agua': {
    id: 'cierre-agua',
    donde: 'Cierre, paso 2, debajo del recibo de agua',
    cuando: 'siempre que hay recibo; compara solo si hay meses anteriores',
    determinista: (d) => {
      const m3 = n(d, 'm3')
      if (lista(d, 'anteriores').length === 0 && !(d.anteriores as unknown[] | undefined)?.length) {
        return `${m3} m³ es lo que llegó en el recibo de ${s(d, 'nombreMes')}. Es el primer mes, así que todavía no hay con qué compararlo.`
      }
      const filas = (d.anteriores ?? []) as { mes: string; valor: number }[]
      const media = filas.reduce((t, a) => t + a.valor, 0) / filas.length
      return m3 > media * 1.15
        ? `${m3} m³ es bastante más que los últimos meses (${anteriores(d, 'm³')}). ¿Lo confirmas?`
        : `${m3} m³ está en línea con los últimos meses: ${anteriores(d, 'm³')}.`
    },
    pregunta: () =>
      'Compara en una frase los m³ que facturó SEDAPAL este mes con los de los meses anteriores que te doy. ' +
      'Si se salió de lo normal, pide que lo confirmen. Si no, dilo y ya.',
    mejorable: true,
  },

  /** El recibo de luz, en el paso 3. Mismo criterio que el agua. */
  'cierre-luz': {
    id: 'cierre-luz',
    donde: 'Cierre, paso 3, debajo del monto de luz',
    cuando: 'siempre que hay monto; compara solo si hay meses anteriores',
    determinista: (d) => {
      const luz = n(d, 'luz')
      const filas = (d.anteriores ?? []) as { mes: string; valor: number }[]
      if (filas.length === 0) {
        return `S/ ${fmt(luz)} de luz común este mes. Es el primero, así que todavía no hay con qué compararlo.`
      }
      const media = filas.reduce((t, a) => t + a.valor, 0) / filas.length
      return luz > media * 1.15
        ? `S/ ${fmt(luz)} es bastante más que los últimos meses (${anteriores(d, 'S/')}). ¿Lo confirmas?`
        : `S/ ${fmt(luz)} está en línea con los últimos meses: ${anteriores(d, 'S/')}.`
    },
    pregunta: () =>
      'Compara en una frase el recibo de luz común de este mes con los de los meses anteriores que te doy. ' +
      'Si se salió de lo normal, pide que lo confirmen.',
    mejorable: true,
  },

  /**
   * Un concepto sin cifra, en el paso 4.
   *
   * El caso real es el pozo a tierra: se sabe que existe y no se sabe cuánto
   * cuesta. `null` y `0` son cosas distintas y la app las trata distinto, así
   * que este aviso dice que se puede seguir sin la cifra, que es lo que quita
   * la duda de si el mes va a quedar mal.
   */
  'cierre-sin-cifra': {
    id: 'cierre-sin-cifra',
    donde: 'Cierre, paso 4, debajo de la lista de conceptos',
    cuando: 'cuando hay al menos un concepto sin monto confirmado',
    determinista: (d) =>
      `${s(d, 'concepto')} sigue sin cifra. Puedes dejarlo así y ponerlo cuando lo tengas.`,
    pregunta: (d) =>
      `Di en una frase que «${s(d, 'concepto')}» todavía no tiene monto y que se puede cerrar el mes igual, ` +
      `poniéndolo cuando se sepa. Que no suene a error.`,
    mejorable: true,
  },

  /**
   * La propuesta de corrección de una lectura, en el paso 1.
   *
   * **Este no se le pasa al modelo.** Es el único de los siete: lo que dice
   * lleva la lectura tecleada, la anterior y la propuesta con tres decimales, y
   * al lado hay dos botones que aplican exactamente esa cifra. Un texto
   * redactado de nuevo, aunque sea correcto, puede describir un número distinto
   * del que el botón va a escribir, y ahí no hay guarda que valga: los dos
   * números existirían.
   */
  'cierre-propuesta': {
    id: 'cierre-propuesta',
    donde: 'Cierre, paso 1, sobre los botones de aceptar o mantener',
    cuando: 'cuando una lectura es menor que la anterior o el salto es desproporcionado',
    determinista: (d) => s(d, 'texto'),
    pregunta: () => '',
    mejorable: false,
  },
}

/** Todos los identificadores, para los esquemas y para los tests. */
export const MOMENTO_IDS = Object.keys(MOMENTOS) as MomentoId[]
