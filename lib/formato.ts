/**
 * Formato de lo que se lee en pantalla.
 *
 * Los montos y los consumos los formatea `lib/calculo/redondeo.ts`, que vive
 * con el motor porque `01` §9 fija la llamada exacta. Aquí van las fechas y los
 * textos derivados, que son de interfaz.
 */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'] as const

/**
 * `'2026-06-08'` → `'8 jun'`.
 *
 * Es como lo escribe la gente en el chat del edificio, y es como lo muestra el
 * prototipo. Una fecha ISO en la pantalla de un vecino se lee como un error.
 */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  if (!anio || !mes || !dia) return '—'
  return `${dia} ${MESES_CORTOS[mes - 1]}`
}

/** Primera letra en mayúscula. Para meter un nombre de mes al principio de una frase. */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Une una lista en castellano: comas, y una sola «y» al final.
 *
 * `join(' y ')` encadenaba: *«la lectura del 202 y la lectura del 301 y la
 * lectura del 401»*. Con dos elementos se lee bien y por eso pasó desapercibido;
 * con tres o más, no. Este texto lo leen los siete en el aviso.
 */
export function enumerar(partes: readonly string[]): string {
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]!
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * Cuánto hace, en castellano y a ojo. `'hace un momento'`, `'hace 3 horas'`.
 *
 * Lo usa el aviso de datos guardados. Ahí la precisión no sirve de nada y la
 * escala sí: para una cuota mensual, la diferencia entre «hace cinco minutos» y
 * «hace cinco semanas» es la diferencia entre un dato útil y uno peligroso.
 */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const cuando = Date.parse(iso)
  if (!Number.isFinite(cuando)) return 'hace un rato'
  const minutos = Math.floor((ahora - cuando) / 60_000)
  if (minutos < 0) return 'hace un momento'
  if (minutos < 2) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} minutos`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return horas === 1 ? 'hace una hora' : `hace ${horas} horas`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  const semanas = Math.floor(dias / 7)
  if (semanas === 1) return 'hace una semana'
  if (semanas < 5) return `hace ${semanas} semanas`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
}
