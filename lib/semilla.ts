/**
 * Los datos con los que arranca la base.
 *
 * Lo que sigue viene de `mockup/datos-edificio.js`. **Está marcado qué es real y
 * qué es de ejemplo**, y lo de ejemplo hay que reemplazarlo con los recibos
 * verdaderos antes de que la app sirva de algo (`06-modelo-de-datos.md` §6).
 *
 * Lo consumen `prisma/seed.ts` y los tests de fidelidad de la Fase 1.
 */

import { DPTOS, GASTOS_FIJOS, LAVADO, SALDO_BASE } from './calculo/constantes'
import type { DptoId, Lecturas, MesId, PagosMes, Recibo } from './calculo/tipos'

// REAL — de la escritura del edificio. No modificar sin documento.
export const DEPARTAMENTOS = DPTOS

// REAL — el lavado del 401, acordado entre los vecinos.
export const REASIGNACION_LAVADO = LAVADO

// REAL — los conceptos y sus montos habituales. Editables desde el panel.
export const FIJOS = GASTOS_FIJOS

// EJEMPLO — realista pero inventado. Reemplazar con las lecturas verdaderas.
export const LECTURAS: Record<MesId, Lecturas> = {
  '2025-12': { '101': 146.380, '201': 122.502, '202': 10.840, '301': 330.320, '401': 328.670, '501': 215.800, '502': 155.040 },
  '2026-01': { '101': 151.851, '201': 131.513, '202': 12.878, '301': 346.625, '401': 343.795, '501': 218.160, '502': 175.530 },
  '2026-02': { '101': 158.455, '201': 141.739, '202': 15.434, '301': 364.626, '401': 359.453, '501': 220.823, '502': 199.922 },
  '2026-03': { '101': 164.219, '201': 151.132, '202': 17.675, '301': 380.743, '401': 374.396, '501': 223.278, '502': 221.909 },
  '2026-04': { '101': 169.465, '201': 159.803, '202': 19.816, '301': 396.052, '401': 388.741, '501': 225.526, '502': 242.249 },
  '2026-05': { '101': 174.699, '201': 168.458, '202': 27.264, '301': 411.048, '401': 403.234, '501': 227.941, '502': 263.888 },
  '2026-06': { '101': 180.230, '201': 177.387, '202': 35.112, '301': 426.921, '401': 420.638, '501': 230.386, '502': 280.748 },
  '2026-07': { '101': 186.461, '201': 185.256, '202': 52.513, '301': 441.532, '401': 438.038, '501': 232.826, '502': 292.678 },
}

// EJEMPLO — realista pero inventado. Reemplazar con los recibos verdaderos.
export const RECIBOS: Record<MesId, Recibo> = {
  '2025-12': { aguaM3: 72, aguaMonto: 299.90, luz: 284.50 },
  '2026-01': { aguaM3: 74, aguaMonto: 308.20, luz: 289.10 },
  '2026-02': { aguaM3: 83, aguaMonto: 346.30, luz: 294.60 },
  '2026-03': { aguaM3: 76, aguaMonto: 317.10, luz: 291.20 },
  '2026-04': { aguaM3: 71, aguaMonto: 296.40, luz: 298.40 },
  '2026-05': { aguaM3: 78, aguaMonto: 325.00, luz: 276.20, descuento: 17.33 },
  '2026-06': { aguaM3: 78, aguaMonto: 325.00, luz: 318.40 },
  '2026-07': { aguaM3: 81, aguaMonto: 338.60, luz: 361.20 },
}

// EJEMPLO — realista pero inventado. Reemplazar con los pagos verdaderos.
export const PAGOS: Record<MesId, PagosMes> = {
  '2026-01': {
    '101': { estado: 'confirmado', fecha: '9 ene', op: '0039140' },
    '201': { estado: 'confirmado', fecha: '6 ene', op: '0039180' },
    '202': { estado: 'confirmado', fecha: '12 ene', op: '0039221' },
    '301': { estado: 'confirmado', fecha: '2 ene', op: '0039261' },
    '401': { estado: 'confirmado', fecha: '7 ene', op: '0039301' },
    '501': { estado: 'confirmado', fecha: '27 ene', op: '0039341' },
    '502': { estado: 'confirmado', fecha: '4 ene', op: '0039382' },
  },
  '2026-02': {
    '101': { estado: 'confirmado', fecha: '11 feb', op: '0039422' },
    '201': { estado: 'confirmado', fecha: '5 feb', op: '0039462' },
    '202': { estado: 'confirmado', fecha: '9 feb', op: '0039503' },
    '301': { estado: 'confirmado', fecha: '3 feb', op: '0039543' },
    '401': { estado: 'confirmado', fecha: '6 feb', op: '0039583' },
    '501': { estado: 'confirmado', fecha: '26 feb', op: '0039623' },
    '502': { estado: 'confirmado', fecha: '4 feb', op: '0039664' },
  },
  '2026-03': {
    '101': { estado: 'confirmado', fecha: '8 mar', op: '0039704' },
    '201': { estado: 'confirmado', fecha: '7 mar', op: '0039744' },
    '202': { estado: 'confirmado', fecha: '13 mar', op: '0039785' },
    '301': { estado: 'confirmado', fecha: '2 mar', op: '0039825' },
    '401': { estado: 'confirmado', fecha: '5 mar', op: '0039865' },
    '501': { estado: 'confirmado', fecha: '28 mar', op: '0039905' },
    '502': { estado: 'confirmado', fecha: '6 mar', op: '0039946' },
  },
  '2026-04': {
    '101': { estado: 'confirmado', fecha: '10 abr', op: '0039986' },
    '201': { estado: 'confirmado', fecha: '4 abr', op: '0040026' },
    '202': { estado: 'confirmado', fecha: '8 abr', op: '0040067' },
    '301': { estado: 'confirmado', fecha: '2 abr', op: '0040107' },
    '401': { estado: 'confirmado', fecha: '9 abr', op: '0040147' },
    '501': { estado: 'confirmado', fecha: '27 abr', op: '0040187' },
    '502': { estado: 'confirmado', fecha: '3 abr', op: '0040228' },
  },
  '2026-05': {
    '101': { estado: 'confirmado', fecha: '6 may', op: '0041880' },
    '201': { estado: 'confirmado', fecha: '9 may', op: '0041955' },
    '202': { estado: 'confirmado', fecha: '3 may', op: '0041790' },
    '301': { estado: 'confirmado', fecha: '2 may', op: '0041744' },
    '401': { estado: 'confirmado', fecha: '7 may', op: '0041902' },
    '501': { estado: 'confirmado', fecha: '28 may', op: '0042510' },
    '502': { estado: 'confirmado', fecha: '5 may', op: '0041861' },
  },
  '2026-06': {
    '101': { estado: 'confirmado', fecha: '14 jun', op: '0043390' },
    '201': { estado: 'aviso', fecha: '24 jul', op: '0044921', texto: 'Transferí el 24 de julio, operación 0044921.' },
    '202': { estado: 'confirmado', fecha: '9 jun', op: '0043211' },
    '301': { estado: 'confirmado', fecha: '2 jun', op: '0043002' },
    '401': { estado: 'confirmado', fecha: '8 jun', op: '0043178' },
    '501': null,
    '502': { estado: 'confirmado', fecha: '4 jun', op: '0043055' },
  },
  '2026-07': {},
}

/** Los meses con recibo, en orden. El primero solo sirve de base de lecturas. */
export const MESES_SEMILLA: readonly MesId[] = Object.keys(RECIBOS).sort()

/** Los meses publicados en la semilla: enero a junio de 2026. */
export const MESES_PUBLICADOS: readonly MesId[] = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
]

/**
 * EJEMPLO — el saldo con el que el prototipo ancla su serie hacia atrás.
 *
 * En producción hace falta **el saldo inicial real de la cuenta** antes del
 * primer mes cargado, y la serie acumula hacia adelante desde ahí. Este valor
 * se usa como saldo inicial de la semilla solo para tener algo con qué arrancar.
 */
export const SALDO_INICIAL_EJEMPLO = SALDO_BASE

export type { DptoId }
