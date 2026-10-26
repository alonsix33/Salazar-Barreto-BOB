/**
 * Lo que identifica a una lista de gastos puntuales y créditos, en orden.
 *
 * Dos listas con la misma huella dan las mismas cuotas, y el orden cuenta
 * porque mueve céntimos. La usan el servicio —para no escribir, auditar ni
 * avisar una corrección que deja la lista igual— y la hoja de corregir —para
 * saber si hay algo que guardar—. **Una sola copia**: si cada lado comparara a
 * su manera, la pantalla diría «hay cambios» y el servidor «no hay nada».
 */
export interface ExtraComparable {
  tipo: string
  concepto?: string
  monto: number | string | { toString(): string }
  dpto?: string | null
  participantes?: readonly string[]
  reparto?: string
}

export function huellaDeExtras(lista: readonly ExtraComparable[]): string {
  return JSON.stringify(
    lista.map((e) => [
      e.tipo,
      e.concepto,
      Number(e.monto).toFixed(2),
      e.dpto ?? null,
      e.tipo === 'gasto' ? [...(e.participantes ?? [])].sort() : [],
      e.tipo === 'gasto' ? (e.reparto ?? 'porcentaje') : 'porcentaje',
    ]),
  )
}
