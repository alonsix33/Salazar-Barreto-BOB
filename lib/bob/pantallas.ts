/**
 * Qué hay en cada pantalla, escrito para que Bob lo pueda decir.
 *
 * Pedido del usuario: si alguien pregunta por la app en sí —«¿qué hay en Mi
 * departamento?», «no entiendo la pantalla de Historial»—, Bob debería saber
 * responder eso también, no solo cifras. Esto es la parte de la app que
 * cualquier vecino puede ver, sin PIN: los cuatro destinos de la barra
 * inferior, más las hojas que Bob mismo enlaza en `lleva`. El panel de
 * administración y sus hojas —cierre, corregir, exportar, cargos— no están
 * aquí a propósito: piden PIN, y explicarlas a quien no administra no ayuda a
 * nadie.
 *
 * Mismo patrón que `procedimientos.ts`, por la misma razón: escrito aparte del
 * prompt para que Bob lo diga sin exponerse a la guarda de números por una
 * cifra de más («las 7 cuotas», «los 3 meses»).
 */

/** Una pantalla o una hoja que cualquier vecino puede abrir. */
export interface Pantalla {
  /** El identificador con el que se pide. */
  clave: string
  /** Cómo lo nombraría un vecino. Sirve para encontrarla por texto. */
  seDiceAsi: readonly string[]
  /** Una frase: qué hay ahí. */
  queEs: string
}

export const PANTALLAS: readonly Pantalla[] = [
  {
    clave: 'inicio',
    seDiceAsi: ['inicio', 'la pantalla principal', 'la portada', 'la primera pantalla'],
    queEs:
      'Tu cuota del mes con su desglose, si ya pagaste, tu consumo de agua, en qué se gastó, cómo va el ' +
      'fondo común, y los siete departamentos de un vistazo.',
  },
  {
    clave: 'el-mes',
    seDiceAsi: ['el mes', 'la pestana el mes', 'la pestana del mes'],
    queEs: 'El mes entero calculado: el total del edificio, la factura de agua, las siete cuotas y los pagos recibidos.',
  },
  {
    clave: 'mi-departamento',
    seDiceAsi: ['mi departamento', 'mi depa', 'mi dpto'],
    queEs: 'Lo tuyo: tu balance, cómo pagar, tu historial de pagos del año y tu consumo de agua mes a mes.',
  },
  {
    clave: 'historial',
    seDiceAsi: ['el historial', 'la pestana de historial', 'la pestana historial'],
    queEs:
      'Los meses anteriores, desde que los siete se autoadministran: la cuenta y el consumo de agua del ' +
      'edificio, mes a mes.',
  },
  {
    clave: 'avisos',
    seDiceAsi: ['avisos', 'las notificaciones', 'la campanita'],
    queEs: 'Todo lo que se movió en el edificio: pagos confirmados, meses publicados, correcciones. Los siete ven lo mismo.',
  },
  {
    clave: 'como-se-calculo',
    seDiceAsi: ['de donde sale cada monto', 'como se calculo', 'el desglose de mi cuota', 'como se calcula mi cuota'],
    queEs: 'El desglose completo de una cuota: cuánto es mantenimiento, cuánto agua, y si hay algún crédito a favor.',
  },
  {
    clave: 'mi-consumo',
    seDiceAsi: ['mi consumo de agua', 'mi historial de agua', 'ver mi consumo'],
    queEs: 'Tu consumo de agua mes a mes, con tu promedio del año.',
  },
  {
    clave: 'mis-pagos',
    seDiceAsi: ['mis pagos', 'mi historial de pagos', 'ver mis pagos'],
    queEs: 'Tu historial de pagos del año: cuáles están al día y cuáles todavía en verificación.',
  },
  {
    clave: 'como-pagar',
    seDiceAsi: ['como pagar', 'los datos para pagar', 'la cuenta para depositar', 'donde deposito'],
    queEs: 'Los datos para depositar, y el botón para avisar que ya pagaste en cuanto transfieras.',
  },
]

/** Minúsculas y sin tildes, igual que en `procedimientos.ts`. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Busca la pantalla que corresponde a un texto libre. Gana la coincidencia más larga. */
export function pantallaPara(texto: string): Pantalla | null {
  const t = normalizar(texto)
  let mejor: Pantalla | null = null
  let largo = 0
  for (const p of PANTALLAS) {
    for (const f of p.seDiceAsi) {
      if (t.includes(f) && f.length > largo) {
        largo = f.length
        mejor = p
      }
    }
  }
  return mejor
}

/**
 * ¿Esto suena a una pregunta sobre la app en sí, y no sobre una cifra?
 *
 * Hace falta esta señal aparte, como en `suenaAComo`: sin ella, «mi
 * departamento debe más que el mes pasado» dispararía la explicación de la
 * pantalla «Mi departamento» por la sola mención del nombre, en vez de la
 * pregunta de comparación que es de verdad.
 */
export function suenaAPreguntaDePantalla(texto: string): boolean {
  const t = normalizar(texto)
  return /(que hay en\b|que es\b|que muestra\b|para que sirve\b|no entiendo (la|el)\b|que puedo ver en\b|que veo en\b)/.test(
    t,
  )
}
