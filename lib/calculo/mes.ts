/** Aritmética de identificadores de mes. Un mes es `'AAAA-MM'`. */

import type { MesId } from './tipos'

const PATRON_MES = /^\d{4}-(0[1-9]|1[0-2])$/

/** `true` si la cadena tiene la forma `'2026-07'` con un mes real. */
export function esMesId(valor: unknown): valor is MesId {
  return typeof valor === 'string' && PATRON_MES.test(valor)
}

/**
 * Estrecha una cadena de la base a `MesId`, **en un solo sitio y con guardia**.
 *
 * La columna `mes` es `VarChar(7)` para Postgres y `MesId` para TypeScript, y la
 * base garantiza la forma con un `CHECK` de patrón (migración
 * `20260905183000_reglas_de_integridad`). El cast `as MesId` estaba repetido por
 * media docena de ficheros; aquí se hace una vez, y además se comprueba: si una
 * fila llegara mal formada —una migración a medias, una escritura a mano—, salta
 * en vez de propagar un `'NaN-NaN'` en silencio.
 */
export function comoMes(valor: string): MesId {
  if (!esMesId(valor)) throw new Error(`Mes mal formado en la base: ${JSON.stringify(valor)}`)
  return valor
}

/**
 * Comprueba la forma y lanza si no es un mes.
 *
 * Sin esto, `mesAnterior('junio')` devolvía `'NaN-NaN'`, `mesCorto('2026-13')`
 * devolvía `undefined` con el tipo declarado `string`, y `etiquetaMes('')`
 * pintaba `"undefined 0"` en la pantalla del vecino. Un identificador de mes mal
 * formado es un error de programación o de datos: se ve, no se disimula.
 */
function exigirMes(id: MesId): [anio: number, mes: number] {
  if (!esMesId(id)) throw new Error(`Identificador de mes inválido: ${JSON.stringify(id)}`)
  const [anio, mes] = id.split('-').map(Number) as [number, number]
  return [anio, mes]
}

/** El mes anterior. `'2026-01'` → `'2025-12'`. */
export function mesAnterior(id: MesId): MesId {
  const [anio, mes] = exigirMes(id)
  return mes === 1
    ? (`${anio - 1}-12` as MesId)
    : (`${anio}-${String(mes - 1).padStart(2, '0')}` as MesId)
}

/** El mes siguiente. `'2026-12'` → `'2027-01'`. */
export function mesSiguiente(id: MesId): MesId {
  const [anio, mes] = exigirMes(id)
  return mes === 12
    ? (`${anio + 1}-01` as MesId)
    : (`${anio}-${String(mes + 1).padStart(2, '0')}` as MesId)
}

const NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

const CORTOS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC',
] as const

/** `'2026-07'` → `'Julio 2026'`. */
export function etiquetaMes(id: MesId): string {
  const [anio, mes] = exigirMes(id)
  return `${NOMBRES[mes - 1]} ${anio}`
}

/**
 * Etiquetas cortas para un eje de meses en orden, con el año **solo cuando
 * cambia** —el primero, y cada enero o salto de año—: `JUL … DIC · ENE '26 …`.
 *
 * Así una serie que cruza de 2025 a 2026 no confunde dos «ENE»: el año aparece
 * donde hace falta y no satura el resto del eje.
 */
export function cortosConAnio(ids: readonly MesId[]): string[] {
  let anioPrevio: number | null = null
  return ids.map((id) => {
    const [anio, mes] = exigirMes(id)
    const corto = CORTOS[mes - 1]!
    const etiqueta = anio !== anioPrevio ? `${corto} '${String(anio).slice(2)}` : corto
    anioPrevio = anio
    return etiqueta
  })
}

/** `'2026-07'` → `'julio'`. En minúscula, como aparece dentro de una frase. */
export function nombreMes(id: MesId): string {
  const [, mes] = exigirMes(id)
  return NOMBRES[mes - 1]!.toLowerCase()
}

/** `'2026-07'` → `'JUL'`. */
export function mesCorto(id: MesId): string {
  const [, mes] = exigirMes(id)
  return CORTOS[mes - 1]!
}
