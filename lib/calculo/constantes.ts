/**
 * Constantes del edificio.
 *
 * Los siete departamentos y sus flats son **reales**: salen de la escritura del
 * edificio (`01-reglas-de-negocio.md` §1). No se modifican sin documento.
 */

import type { Departamento, DptoId, GastoFijo, MesId } from './tipos'

/** REAL — de la escritura del edificio. Los flats suman exactamente 100.00. */
export const DPTOS: readonly Departamento[] = [
  { id: '101', nombre: 'Irallys y Aaron', flat: 11.72, piso: 1 },
  { id: '201', nombre: 'Carlos Mori', flat: 10.21, piso: 2 },
  { id: '202', nombre: 'Renzo', flat: 20.11, piso: 2 },
  { id: '301', nombre: 'Deborah y Oscar', flat: 10.21, piso: 3 },
  { id: '401', nombre: 'Alonso y Julisa', flat: 10.21, piso: 4 },
  { id: '501', nombre: 'Inmobiliaria', flat: 17.31, piso: 5 },
  { id: '502', nombre: 'Yara y Gianpierre', flat: 20.23, piso: 5 },
] as const

export const DPTO_IDS: readonly DptoId[] = DPTOS.map((d) => d.id)

/** Busca un departamento por id. Lanza si no existe: los siete son fijos. */
export function dpto(id: DptoId): Departamento {
  const encontrado = DPTOS.find((d) => d.id === id)
  if (!encontrado) throw new Error(`Departamento desconocido: ${id}`)
  return encontrado
}

/**
 * El lavado de vehículo del 401. `01` §3.3.
 *
 * Se **reasigna**: se restan los m³ del área común y se le suman al 401. El
 * total del edificio no cambia. Los m³ son configurables desde el panel.
 */
export const LAVADO = {
  dpto: '401' as DptoId,
  m3: 1.5,
  desde: '2026-05' as MesId,
  concepto: 'lavado de vehículo',
} as const

/**
 * Los diez conceptos de gasto. `01` §4.
 *
 * Los cuatro marcados como anuales son servicios contratados por año: el monto
 * que aparece ya es la doceava parte. El pozo a tierra va en `null` —**no en 0**—
 * porque "sin cifra confirmada" y "cuesta cero" son cosas distintas y la
 * interfaz las muestra distinto.
 *
 * La factura de agua y el recibo de luz no están aquí: son variables del mes y
 * el motor los inserta en su posición exacta dentro de la lista.
 */
export const GASTOS_FIJOS: readonly GastoFijo[] = [
  { concepto: 'Guardianía · Jorge', monto: 1625.0 },
  { concepto: 'Ascensor', monto: 680.0 },
  { concepto: 'Mant. bomba', monto: 208.33, anual: true },
  { concepto: 'Mant. cisterna', monto: 50.0, anual: true },
  { concepto: 'Cerco eléctrico', monto: 48.75, anual: true },
  { concepto: 'Cambio extintor', monto: 32.5, anual: true },
  { concepto: 'Insumos limpieza', monto: 30.0 },
  { concepto: 'Pozo a tierra', monto: null, porConfirmar: true },
] as const

/** Los conceptos en el orden en que la lista de gastos del mes los muestra. */
export const ORDEN_GASTOS = [
  'Guardianía · Jorge',
  'Ascensor',
  'Factura de agua SEDAPAL',
  'Recibo de luz común',
  'Mant. bomba',
  'Mant. cisterna',
  'Cerco eléctrico',
  'Cambio extintor',
  'Insumos limpieza',
  'Pozo a tierra',
] as const

export const CONCEPTO_AGUA = 'Factura de agua SEDAPAL'
export const CONCEPTO_LUZ = 'Recibo de luz común'

/**
 * Saldo con el que el prototipo ancla su serie hacia atrás.
 *
 * En producción **no se usa para calcular**: el saldo acumula hacia adelante
 * desde el saldo inicial real guardado en la base (ver `saldo.ts`). Se conserva
 * solo para poder reproducir la serie del mockup en los tests de fidelidad.
 */
export const SALDO_BASE = 4182.4

/**
 * Tolerancias de los dos cuadres. `01` §5.
 *
 * Son el **suelo**, no el techo. Ver `toleranciaAgua` justo debajo.
 */
export const TOLERANCIA_AGUA = 0.03
export const TOLERANCIA_MES = 0.05

/** Lo que cada `round2` puede desviar como mucho: medio céntimo. */
const MEDIO_CENTIMO = 0.005

/**
 * Cuánto puede desviarse el cuadre del agua **solo por los redondeos que las
 * propias reglas imponen**.
 *
 * Esto no es una tolerancia elegida: es una cota calculada. `01` §3 manda
 * redondear a dos decimales los m³ que se le cobran a cada departamento y otra
 * vez el monto que sale de multiplicarlos por el precio. Con siete
 * departamentos más el área común son ocho redondeos de m³, que valen medio
 * céntimo de m³ **multiplicado por el precio del m³**, y ocho de soles.
 *
 * De ahí sale el defecto que esto arregla: **la tolerancia era una constante y
 * el error es proporcional al precio del agua.** Medido sobre 7 980 meses
 * generados, con los medidores midiendo más de lo facturado —el reparto
 * ajustado de `01` §3.4, que es un caso legítimo y documentado— fallaban el
 * cuadre **7 980 de 7 980**, con desvíos de hasta S/ 0.30 contra una
 * tolerancia de S/ 0.03. Ninguno de esos meses tenía nada mal: quien administra
 * no podía publicarlos y no había forma de saber por qué.
 *
 * El suelo de `01` §5 se respeta: esto solo ensancha donde el redondeo prueba
 * que hace falta, nunca aprieta. Y para que ensanchar no ciegue nada, el
 * cuadre en m³ de `TOLERANCIA_M3` no depende del precio y sigue siendo estrecho.
 */
export function toleranciaAgua(precioM3: number): number {
  if (!Number.isFinite(precioM3) || precioM3 < 0) return TOLERANCIA_AGUA
  const n = DPTOS.length + 1 // los siete departamentos más el área común
  return Math.max(TOLERANCIA_AGUA, n * MEDIO_CENTIMO * precioM3 + n * MEDIO_CENTIMO)
}

/**
 * Lo mismo para el cuadre del mes, que arrastra el del agua.
 *
 * Suma dos redondeos más por departamento: el del mantenimiento y el del total
 * de la cuota.
 */
export function toleranciaMes(precioM3: number): number {
  return Math.max(TOLERANCIA_MES, toleranciaAgua(precioM3) + 2 * DPTOS.length * MEDIO_CENTIMO)
}

/**
 * El cuadre que **no** depende del precio: en metros cúbicos.
 *
 * Existe justo para que ensanchar la tolerancia en soles no tape nada. Un
 * departamento que se pierda del reparto, un factor de ajuste mal aplicado o un
 * lavado que se cobre dos veces mueven los m³, y eso se ve aquí valga el agua
 * lo que valga. Ocho redondeos de medio céntimo de m³.
 */
export const TOLERANCIA_M3 = (DPTOS.length + 1) * MEDIO_CENTIMO
