/**
 * Ayudas de test: arman las `EntradasMes` desde la semilla para poder escribir
 * los casos de `01-reglas-de-negocio.md` §10 tal como están en el documento.
 *
 * No es un archivo de test: vitest solo recoge `*.test.ts`.
 */

import { calcularMes } from '../calcularMes'
import { mesAnterior } from '../mes'
import type { EntradasMes, MesId, Overrides, ResultadoMes } from '../tipos'
import { FIJOS, LECTURAS, RECIBOS, REASIGNACION_LAVADO } from '../../semilla'

export function entradasDe(mesId: MesId): EntradasMes {
  return {
    mesId,
    recibo: RECIBOS[mesId] ?? null,
    lecturas: LECTURAS[mesId] ?? {},
    lecturasAnteriores: LECTURAS[mesAnterior(mesId)] ?? {},
    fijos: FIJOS,
    extras: [],
    lavadoM3: REASIGNACION_LAVADO.m3,
  }
}

/** `calcularMes(mesId, overrides)` con los datos de la semilla, como el prototipo. */
export function calcularMesSemilla(mesId: MesId, ov: Overrides = {}): ResultadoMes {
  return calcularMes(entradasDe(mesId), ov)
}
