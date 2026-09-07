/**
 * La historia de un departamento: sus pagos y su consumo.
 *
 * Es lo que alimenta P3 (Mi departamento) y las hojas `pagos` y `agua`.
 */

import { DPTOS } from '@/lib/calculo/constantes'
import { etiquetaMes, mesCorto } from '@/lib/calculo/mes'
import { round2 } from '@/lib/calculo/redondeo'
import type { DptoId, EstadoPago } from '@/lib/calculo/tipos'
import { pagosDe, resultadoDeMes } from './mes'
import { mesesPublicados } from './meses'

export interface FilaHistorial {
  mes: string
  etiqueta: string
  corto: string
  cuota: number | null
  m3: number
  lavado: number
  estado: EstadoPago | null
  fecha: string | null
  operacion: string | null
}

export interface HistorialDpto {
  dpto: DptoId
  nombre: string
  flat: number
  piso: number
  filas: FilaHistorial[]
  /** Total pagado en meses confirmados. */
  totalPagado: number
  mesesAlDia: number
  mesesEnVerificacion: number
  /** Promedio de m³ cobrados en los meses de la serie. */
  promedioM3: number
}

const MESES_A_MOSTRAR = 12

export async function historialDeDpto(dpto: DptoId): Promise<HistorialDpto> {
  const info = DPTOS.find((d) => d.id === dpto)
  if (!info) throw new Error(`No existe el departamento ${dpto}`)

  const meses = (await mesesPublicados()).slice(-MESES_A_MOSTRAR)
  const filas: FilaHistorial[] = []
  let totalPagado = 0
  let alDia = 0
  let enVerificacion = 0
  let sumaM3 = 0

  for (const mes of meses) {
    const [resultado, pagos] = await Promise.all([resultadoDeMes(mes), pagosDe(mes)])
    const pago = pagos[dpto] ?? null
    const cuota = resultado.valido ? resultado.cuotas[dpto].total : null
    const m3 = resultado.valido ? resultado.cuotas[dpto].m3 : 0
    sumaM3 += m3
    if (pago?.estado === 'confirmado') {
      alDia++
      totalPagado += cuota ?? 0
    } else if (pago?.estado === 'aviso') {
      enVerificacion++
    }
    filas.push({
      mes,
      etiqueta: etiquetaMes(mes),
      corto: mesCorto(mes),
      cuota,
      m3,
      lavado: resultado.valido ? resultado.cuotas[dpto].lavado : 0,
      estado: pago?.estado ?? null,
      fecha: pago?.fecha ?? null,
      operacion: pago?.op ?? null,
    })
  }

  return {
    dpto,
    nombre: info.nombre,
    flat: info.flat,
    piso: info.piso,
    filas,
    totalPagado: round2(totalPagado),
    mesesAlDia: alDia,
    mesesEnVerificacion: enVerificacion,
    promedioM3: filas.length ? round2(sumaM3 / filas.length) : 0,
  }
}


export interface VistaAnual {
  anio: number
  /** Doce casillas, índice 0 = enero … 11 = diciembre. `null` si ese mes no está. */
  slots: (FilaHistorial | null)[]
  totalPagado: number
  mesesAlDia: number
  mesesEnVerificacion: number
  promedioM3: number
  /** El m³ más alto del año, para escalar las barras dentro de la tira. */
  maximoM3: number
}

/**
 * La historia de un año de calendario, para la tira ENE→DIC de Mi departamento.
 *
 * La tira del prototipo tiene doce casillas fijas rotuladas ENE a DIC, y cada
 * una **es** su mes del calendario. La auditoría final encontró que producción
 * llenaba las casillas por posición con «los últimos doce meses publicados», así
 * que el eje mentía en cuanto la serie dejaba de empezar en enero: a partir de
 * la publicación número trece, la casilla rotulada ENE mostraba febrero. Y de
 * paso, «pagado en 2026» y «tu promedio del año» se calculaban sobre esa ventana
 * móvil, no sobre el año.
 *
 * Esto reindexa por mes de calendario y acota los agregados al año que se mira,
 * que es lo que el diseño quería decir. Un mes sin publicar es una casilla
 * vacía, no la de otro mes.
 */
export function vistaAnual(filas: readonly FilaHistorial[], anio: number): VistaAnual {
  const delAnio = filas.filter((f) => f.mes.startsWith(`${anio}-`))
  const slots: (FilaHistorial | null)[] = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0')
    return delAnio.find((f) => f.mes === `${anio}-${mm}`) ?? null
  })
  let totalPagado = 0
  let alDia = 0
  let enVerificacion = 0
  let sumaM3 = 0
  let conM3 = 0
  let maximoM3 = 0
  for (const f of delAnio) {
    if (f.estado === 'confirmado') {
      alDia++
      totalPagado += f.cuota ?? 0
    } else if (f.estado === 'aviso') {
      enVerificacion++
    }
    // El promedio se toma sobre los meses con consumo de verdad, no sobre los
    // que aún no tienen recibo: un mes vacío no baja el promedio a cero.
    if (f.cuota !== null) {
      sumaM3 += f.m3
      conM3++
      if (f.m3 > maximoM3) maximoM3 = f.m3
    }
  }
  return {
    anio,
    slots,
    totalPagado: round2(totalPagado),
    mesesAlDia: alDia,
    mesesEnVerificacion: enVerificacion,
    promedioM3: conM3 ? round2(sumaM3 / conM3) : 0,
    maximoM3,
  }
}
