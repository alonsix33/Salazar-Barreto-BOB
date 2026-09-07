/**
 * Editar los montos de los gastos fijos.
 *
 * Un cambio **no reescribe el pasado**: se guarda una fila nueva con su
 * `vigenteDesde`, y cada mes usa la que estaba vigente entonces. Si no fuera
 * así, subir el ascensor en agosto cambiaría las cuotas de enero, que ya se
 * cobraron.
 *
 * Eso valía para los meses anteriores a `vigenteDesde`. Faltaba el propio
 * `vigenteDesde`: nada comprobaba que ese mes no estuviera **ya publicado**, y
 * la fila se escribía encima. Medido: con junio de 2026 publicado, un PUT sobre
 * junio subió la cuota del 101 de S/ 373.82 a S/ 1,355.25, el vecino veía la
 * nueva, y el aviso que salía decía «los meses ya cerrados no cambian». Es el
 * caso real de dos aparatos: el cierre abierto en el paso 4 del móvil, publicado
 * desde la laptop, y un toque más en el móvil sobre la pestaña vieja.
 */

import { prisma } from '@/lib/datos/prisma'
import { aDecimal2, aNumero } from '@/lib/datos/decimal'
import { nombreMes, comoMes } from '@/lib/calculo/mes'
import { fmt } from '@/lib/calculo/redondeo'
import type { GuardarGastosFijos } from '@/lib/esquemas'
import { auditar, avisar } from './auditoria'
import { exigirNoPublicado, tomarVersion } from './bloqueo'

export async function guardarGastosFijos(
  datos: GuardarGastosFijos,
  /**
   * `true` cuando la escritura viene del **paso 4 del cierre**.
   *
   * Cambia una sola cosa: no se avisa a los siete. Los pasos 1 a 6 no publican
   * nada, y avisar desde ahí mandaba a siete personas un mensaje sobre un mes
   * que para ellas no existe —y uno por cada tanteo del numpad—. Desde el panel
   * de administración sí se avisa: eso no es una tecla del cierre, es una
   * decisión que cambia lo que se paga a partir de ese mes (`06` §3).
   */
  desdeElCierre = false,
  /** La versión del cierre que el cliente tenía. Solo la manda el paso 4. */
  version?: number,
) {
  return prisma.$transaction(async (tx) => {
    // Un mes publicado es un hecho: para cambiarlo está corregir, que avisa.
    await exigirNoPublicado(tx, datos.vigenteDesde)
    // Y desde el cierre pasa por el mismo bloqueo que el resto de los pasos.
    if (desdeElCierre) await tomarVersion(tx, datos.vigenteDesde, version)

    const cambiados: { concepto: string; de: number | null; a: number | null }[] = []

    for (const cambio of datos.cambios) {
      const vigente = await tx.gastoFijo.findFirst({
        where: { concepto: cambio.concepto, vigenteDesde: { lte: datos.vigenteDesde } },
        orderBy: { vigenteDesde: 'desc' },
      })
      const de = vigente ? aNumero(vigente.monto) : null
      if (de === cambio.monto) continue

      await tx.gastoFijo.upsert({
        where: { concepto_vigenteDesde: { concepto: cambio.concepto, vigenteDesde: datos.vigenteDesde } },
        create: {
          concepto: cambio.concepto,
          monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
          anual: cambio.anual ?? vigente?.anual ?? false,
          vigenteDesde: datos.vigenteDesde,
          orden: vigente?.orden ?? 99,
        },
        update: {
          monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
          ...(cambio.anual === undefined ? {} : { anual: cambio.anual }),
        },
      })
      await auditar(tx, {
        usuario: 'admin',
        accion: vigente ? 'editar' : 'crear',
        entidad: 'gastoFijo',
        entidadId: `${cambio.concepto}@${datos.vigenteDesde}`,
        campo: 'monto',
        valorAnterior: de,
        valorNuevo: cambio.monto,
        mes: datos.vigenteDesde,
      })
      cambiados.push({ concepto: cambio.concepto, de, a: cambio.monto })
    }

    // Un gasto fijo cambia lo que pagan los siete a partir de ese mes: desde el
    // panel sí avisa, porque no es una tecla del cierre sino una decisión de
    // administración (`06` §3). Desde el paso 4, no: ver `desdeElCierre`.
    for (const c of desdeElCierre ? [] : cambiados) {
      await avisar(tx, {
        tipo: 'gasto_fijo',
        titulo:
          c.a === null
            ? `${c.concepto} queda por confirmar desde ${nombreMes(comoMes(datos.vigenteDesde))}`
            : c.de === null
              ? `${c.concepto} queda en S/ ${fmt(c.a)} desde ${nombreMes(comoMes(datos.vigenteDesde))}`
              : `${c.concepto} pasó de S/ ${fmt(c.de)} a S/ ${fmt(c.a)} desde ${nombreMes(comoMes(datos.vigenteDesde))}`,
        detalle: 'Los meses ya cerrados no cambian.',
        mes: datos.vigenteDesde,
      })
    }

    return { cambiados }
  })
}
