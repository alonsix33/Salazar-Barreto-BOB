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

    const cambiados: {
      concepto: string
      de: number | null
      a: number | null
      activoDe: boolean
      activoA: boolean
      anualDe: boolean
      anualA: boolean
    }[] = []

    for (const cambio of datos.cambios) {
      const vigente = await tx.gastoFijo.findFirst({
        where: { concepto: cambio.concepto, vigenteDesde: { lte: datos.vigenteDesde } },
        orderBy: { vigenteDesde: 'desc' },
      })
      const de = vigente ? aNumero(vigente.monto) : null
      const activoDe = vigente?.activo ?? true
      const activoA = cambio.activo ?? activoDe
      const anualDe = vigente?.anual ?? false
      const anualA = cambio.anual ?? anualDe
      /**
       * Antes esto solo miraba el monto: `if (de === cambio.monto) continue`.
       * Con `activo` y `anual` de por medio, un cambio que solo los toca a
       * ellos —el monto se queda igual, que es el caso normal de marcar o
       * desmarcar «es anual» o de apagar un concepto— entraba en ese
       * `continue` y no se escribía nada. Apagar "Guardianía" sin tocar su
       * S/ 1,625, o marcarla como anual sin cambiar el monto, quedaba en
       * silencio, sin auditoría y sin aviso, mientras la interfaz mostraba que
       * ya se había guardado.
       */
      if (de === cambio.monto && activoA === activoDe && anualA === anualDe) continue

      await tx.gastoFijo.upsert({
        where: { concepto_vigenteDesde: { concepto: cambio.concepto, vigenteDesde: datos.vigenteDesde } },
        create: {
          concepto: cambio.concepto,
          monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
          anual: cambio.anual ?? vigente?.anual ?? false,
          activo: activoA,
          vigenteDesde: datos.vigenteDesde,
          orden: vigente?.orden ?? 99,
        },
        update: {
          monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
          ...(cambio.anual === undefined ? {} : { anual: cambio.anual }),
          activo: activoA,
        },
      })
      await auditar(tx, {
        usuario: 'admin',
        accion: vigente ? 'editar' : 'crear',
        entidad: 'gastoFijo',
        entidadId: `${cambio.concepto}@${datos.vigenteDesde}`,
        campo: activoA !== activoDe ? 'activo' : 'monto',
        valorAnterior: activoA !== activoDe ? (activoDe ? 'activo' : 'inactivo') : de,
        valorNuevo: activoA !== activoDe ? (activoA ? 'activo' : 'inactivo') : cambio.monto,
        mes: datos.vigenteDesde,
      })
      cambiados.push({ concepto: cambio.concepto, de, a: cambio.monto, activoDe, activoA, anualDe, anualA })
    }

    // Un gasto fijo cambia lo que pagan los siete a partir de ese mes: desde el
    // panel sí avisa, porque no es una tecla del cierre sino una decisión de
    // administración (`06` §3). Desde el paso 4, no: ver `desdeElCierre`.
    for (const c of desdeElCierre ? [] : cambiados) {
      const desde = nombreMes(comoMes(datos.vigenteDesde))
      const titulo =
        c.activoA !== c.activoDe
          ? c.activoA
            ? `${c.concepto} vuelve a cobrarse desde ${desde}`
            : `${c.concepto} ya no se cobra desde ${desde}`
          : c.a === c.de && c.anualA !== c.anualDe
            ? c.anualA
              ? `${c.concepto} ahora se cobra dividido entre 12 meses, desde ${desde}`
              : `${c.concepto} deja de dividirse entre 12 meses, desde ${desde}`
            : c.a === null
              ? `${c.concepto} queda por confirmar desde ${desde}`
              : c.de === null
                ? `${c.concepto} queda en S/ ${fmt(c.a)} desde ${desde}`
                : `${c.concepto} pasó de S/ ${fmt(c.de)} a S/ ${fmt(c.a)} desde ${desde}`
      await avisar(tx, {
        tipo: 'gasto_fijo',
        titulo,
        detalle: 'Los meses ya cerrados no cambian.',
        mes: datos.vigenteDesde,
      })
    }

    return { cambiados }
  })
}
