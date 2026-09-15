/**
 * Las reglas de lectura, **sobre filas ya en memoria**.
 *
 * ## Por qué está aparte
 *
 * Hay dos caminos para leer un mes y tiene que haberlos: las pantallas leen de
 * la foto del edificio —las siete tablas de una vez, `almanaque.ts`— y las
 * transacciones leen de la base dentro del `tx`, porque necesitan ver lo que
 * acaban de escribir y todavía no está confirmado.
 *
 * Lo que **no** puede haber son dos copias de la regla. Ya pasó una vez en este
 * proyecto: `corregirMes` tenía su propia copia de `entradasDeMes`, las dos se
 * separaron, y la de allí no heredaba la marca del lavado del mes anterior, así
 * que el aviso que recibían los siete —«el 401 pasó de X a Y»— citaba una Y que
 * la app no cobraba.
 *
 * Y volvió a pasar al montar la foto: `almanaque.ts` reimplementó la herencia
 * del lavado y la vigencia de los gastos fijos. La prueba negativa lo cazó —el
 * defecto inyectado en `mes.ts` dejó de ponerse rojo, porque las pantallas ya
 * no pasaban por ahí—, que es exactamente para lo que existe.
 *
 * Así que la regla vive aquí, una vez, y recibe filas llanas. Quien las trae
 * —Prisma dentro de una transacción, o la foto— es lo único que cambia.
 */

import { mesAnterior } from '@/lib/calculo/mes'
import type { DptoId, Extra, GastoFijo, MesId, Pago } from '@/lib/calculo/tipos'

/** Una reasignación de agua con sus marcas por mes, ya sin `Decimal`. */
export interface FilaReasignacion {
  m3: number
  desde: string
  activaEn: readonly { mes: string; activa: boolean; m3: number | null }[]
}

/** Un gasto fijo con su vigencia, ya sin `Decimal`. */
export interface FilaFijo {
  concepto: string
  monto: number | null
  anual: boolean
  /** `false` = no se cobra desde `vigenteDesde`. Ver `GastoFijo.activo`. */
  activo: boolean
  vigenteDesde: string
  orden: number
}

/** Un gasto o crédito puntual, ya sin `Decimal`. */
export interface FilaExtra {
  tipo: 'gasto' | 'credito'
  concepto: string
  monto: number
  dptoId: string | null
  participantes: readonly string[]
  reparto: 'porcentaje' | 'iguales'
}

/** Un pago, ya sin `Decimal` ni `Date`. */
export interface FilaPagoCruda {
  estado: 'confirmado' | 'aviso'
  /** `'2026-08-13'`. */
  fecha: string
  monto: number | null
  operacion: string | null
  texto: string | null
}

/**
 * Los m³ del lavado que aplican a un mes.
 *
 * 0 si la casilla del paso 5 está desmarcada para ese mes. Si no hay marca
 * explícita, se hereda: viene marcada si estuvo activa el mes anterior.
 *
 * @param reasignaciones Ordenadas de la más reciente a la más antigua por
 *   `desde`. Se toma la primera que ya aplica a este mes.
 */
export function lavadoDeLasFilas(
  reasignaciones: readonly FilaReasignacion[],
  mes: MesId,
): number {
  const r = reasignaciones.find((x) => x.desde <= mes)
  if (!r) return 0

  /**
   * Los m³ de **este** mes, no los de hoy.
   *
   * Si el mes tiene un valor congelado, manda ese: se grabó al publicarlo y es
   * con el que se calcularon las siete cuotas que la gente ya vio. Sin esta
   * línea, subir el consumo del lavado de 1.50 a 3.00 movía la cuota del 401 en
   * junio de 2026 en S/ 6.25 —un mes cerrado y avisado— mientras el aviso a los
   * siete decía que los meses cerrados no se tocan.
   */
  const vigente = (congelado: number | null | undefined) =>
    congelado === null || congelado === undefined ? r.m3 : congelado

  const marcaDelMes = r.activaEn.find((a) => a.mes === mes)
  if (marcaDelMes) return marcaDelMes.activa ? vigente(marcaDelMes.m3) : 0
  // Sin marca explícita: se hereda la del mes anterior, y si tampoco la hay,
  // se asume activa desde la fecha en que empieza a aplicar. El valor, en
  // cambio, no se hereda: un mes sin cerrar sigue el actual.
  const anterior = r.activaEn.find((a) => a.mes === mesAnterior(mes))
  if (anterior) return anterior.activa ? r.m3 : 0
  return r.m3
}

/**
 * La fila vigente de cada concepto de gasto fijo en un mes, **sin filtrar por
 * `activo`**: quien la llama decide si le hace falta ver también los
 * apagados (el panel de administración, para poder reactivarlos) o no (el
 * motor, que solo cobra lo activo — ver `fijosDeLasFilas`).
 *
 * Un cambio de monto no reescribe el pasado: para cada concepto se toma la
 * fila con el `vigenteDesde` más alto que no pase del mes pedido.
 *
 * Vivía duplicada: `lib/datos/admin.ts` tenía su propia copia de este mismo
 * `Map` para el panel de administración. La regla de este archivo (`filas.ts`
 * §"Por qué está aparte") es que no puede haber dos copias — ya costó caro
 * antes, dos veces — así que ahora las dos usan esta.
 *
 * @param fijos Ordenados por `[orden asc, vigenteDesde asc]`. El orden importa:
 *   la última fila de cada concepto es la que gana, y es la más reciente.
 */
export function fijosVigentesDeLasFilas<T extends { concepto: string; vigenteDesde: string }>(
  fijos: readonly T[],
  mes: MesId,
): T[] {
  const porConcepto = new Map<string, T>()
  for (const f of fijos) if (f.vigenteDesde <= mes) porConcepto.set(f.concepto, f)
  return [...porConcepto.values()]
}

/**
 * Los gastos fijos **activos** de un mes, tal como los necesita el motor.
 *
 * Si una fila dice `activo: false`, el concepto no aparece en la lista de ese
 * mes en adelante, aunque siga entero en la base para cuando se reactive.
 */
export function fijosDeLasFilas(fijos: readonly FilaFijo[], mes: MesId): GastoFijo[] {
  return fijosVigentesDeLasFilas(fijos, mes)
    .filter((f) => f.activo)
    .sort((a, b) => a.orden - b.orden || a.concepto.localeCompare(b.concepto))
    .map((f) => ({
      concepto: f.concepto,
      monto: f.monto,
      ...(f.anual ? { anual: true } : {}),
      ...(f.monto === null ? { porConfirmar: true } : {}),
    }))
}

/** Un gasto o crédito puntual, tal como lo espera el motor. */
export function extraDeLaFila(e: FilaExtra): Extra {
  return e.tipo === 'credito'
    ? { tipo: 'credito', concepto: e.concepto, monto: e.monto, dpto: e.dptoId as DptoId }
    : {
        tipo: 'gasto',
        concepto: e.concepto,
        monto: e.monto,
        // `as`: la columna guarda ids de departamento, los mismos siete de
        // `DPTOS`. Vacío significa "lo pagan todos" y el motor lo trata así.
        participantes: e.participantes as DptoId[],
        reparto: e.reparto,
      }
}

/** Un pago, tal como lo espera el motor. */
export function pagoDeLaFila(p: FilaPagoCruda): Pago {
  return { estado: p.estado, fecha: p.fecha, monto: p.monto, op: p.operacion, texto: p.texto }
}
