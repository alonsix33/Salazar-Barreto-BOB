/**
 * La tira ENE→DIC de Mi departamento. `03-pantallas.md` P3.
 *
 * La auditoría final encontró que las doce casillas se llenaban por posición
 * con «los últimos doce meses publicados», mientras el eje debajo decía ENE a
 * DIC fijo. Coincidía solo mientras la serie empezaba en enero; a partir de la
 * publicación número trece, la casilla rotulada ENE mostraba febrero. Este test
 * fija que cada casilla **es** su mes de calendario.
 */

import { describe, expect, it } from 'vitest'
import { vistaAnual, type FilaHistorial } from '../historial'

function fila(mes: string, m3: number, estado: FilaHistorial['estado'] = 'confirmado'): FilaHistorial {
  return { mes, etiqueta: mes, corto: mes, cuota: 100, m3, lavado: 0, estado, fecha: null, operacion: null }
}

describe('vistaAnual · cada casilla es su mes de calendario', () => {
  it('coloca marzo en la casilla de marzo, no en la primera', () => {
    // El caso del defecto: la serie empieza en marzo (enero y febrero sin publicar).
    const v = vistaAnual([fila('2026-03', 30), fila('2026-04', 40), fila('2026-05', 50)], 2026)
    expect(v.slots[0]).toBeNull() // enero, vacío
    expect(v.slots[1]).toBeNull() // febrero, vacío
    expect(v.slots[2]?.mes).toBe('2026-03') // marzo en su sitio
    expect(v.slots[3]?.mes).toBe('2026-04')
    expect(v.slots[4]?.mes).toBe('2026-05')
    expect(v.slots.slice(5).every((f) => f === null)).toBe(true)
  })

  it('con trece meses publicados, la casilla de enero es enero, no febrero', () => {
    // ene 2026 … ene 2027: catorce meses. La vista de 2026 debe ser ene–dic 2026.
    const filas: FilaHistorial[] = []
    for (const [a, meses] of [[2026, 12], [2027, 2]] as const) {
      for (let m = 1; m <= meses; m++) filas.push(fila(`${a}-${String(m).padStart(2, '0')}`, m))
    }
    const v = vistaAnual(filas, 2026)
    expect(v.slots[0]?.mes).toBe('2026-01') // NO 2026-02
    expect(v.slots[11]?.mes).toBe('2026-12')
    // Y la vista de 2027 tiene solo enero y febrero, en sus casillas.
    const v27 = vistaAnual(filas, 2027)
    expect(v27.slots[0]?.mes).toBe('2027-01')
    expect(v27.slots[1]?.mes).toBe('2027-02')
    expect(v27.slots.slice(2).every((f) => f === null)).toBe(true)
  })

  it('los agregados son del año, no de una ventana móvil', () => {
    const filas: FilaHistorial[] = []
    for (let m = 1; m <= 12; m++) filas.push(fila(`2026-${String(m).padStart(2, '0')}`, 10))
    filas.push(fila('2027-01', 99)) // enero del año siguiente, fuera de 2026
    const v = vistaAnual(filas, 2026)
    expect(v.mesesAlDia).toBe(12) // los doce de 2026, ni uno de 2027
    expect(v.totalPagado).toBe(1200) // 12 × 100, sin el de 2027
    expect(v.promedioM3).toBe(10) // no arrastra el 99 de enero 2027
  })

  it('un mes sin recibo no baja el promedio a cero', () => {
    const v = vistaAnual(
      [fila('2026-01', 20), { ...fila('2026-02', 0, 'confirmado'), cuota: null }],
      2026,
    )
    // Solo enero tiene consumo de verdad; febrero está pagado pero sin recibo.
    expect(v.promedioM3).toBe(20)
  })
})
