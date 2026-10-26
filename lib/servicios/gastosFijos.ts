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
import { nombreMes, comoMes, mesSiguiente } from '@/lib/calculo/mes'
import type { MesId } from '@/lib/calculo/tipos'
import { fmt } from '@/lib/calculo/redondeo'
import type { GuardarGastosFijos } from '@/lib/esquemas'
import { auditar, avisar, type Tx } from './auditoria'
import { exigirNoPublicado, tomarVersion } from './bloqueo'
import { peticionMala } from './errores'

/**
 * El lugar de un gasto fijo nuevo en la lista: al final de verdad.
 *
 * Antes caía en `99` fijo, así que el segundo concepto añadido empataba con el
 * primero y el orden entre ellos lo decidía el alfabeto, no quien los añadió.
 */
async function ordenParaUnoNuevo(tx: Tx): Promise<number> {
  const ultimo = await tx.gastoFijo.aggregate({ _max: { orden: true } })
  return (ultimo._max.orden ?? 0) + 1
}

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
          orden: vigente?.orden ?? (await ordenParaUnoNuevo(tx)),
        },
        update: {
          monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
          ...(cambio.anual === undefined ? {} : { anual: cambio.anual }),
          activo: activoA,
        },
      })
      /**
       * Un apunte por cada campo que de verdad cambió, no uno solo con el de
       * mayor prioridad. Con un único `auditar()` eligiendo entre `activo` y
       * `monto`, reactivar un concepto **y** subirle el monto en la misma
       * llamada dejaba el cambio de monto sin ningún rastro —violaba la regla
       * de que toda escritura deja rastro en `Auditoria`—. Hoy el panel nunca
       * manda los dos juntos, pero la ruta pública no lo impide.
       */
      if (de !== cambio.monto) {
        await auditar(tx, {
          usuario: 'admin', accion: vigente ? 'editar' : 'crear', entidad: 'gastoFijo',
          entidadId: `${cambio.concepto}@${datos.vigenteDesde}`,
          campo: 'monto', valorAnterior: de, valorNuevo: cambio.monto, mes: datos.vigenteDesde,
        })
      }
      if (activoA !== activoDe) {
        await auditar(tx, {
          usuario: 'admin', accion: vigente ? 'editar' : 'crear', entidad: 'gastoFijo',
          entidadId: `${cambio.concepto}@${datos.vigenteDesde}`,
          campo: 'activo',
          valorAnterior: activoDe ? 'activo' : 'inactivo',
          valorNuevo: activoA ? 'activo' : 'inactivo',
          mes: datos.vigenteDesde,
        })
      }
      if (anualA !== anualDe) {
        await auditar(tx, {
          usuario: 'admin', accion: vigente ? 'editar' : 'crear', entidad: 'gastoFijo',
          entidadId: `${cambio.concepto}@${datos.vigenteDesde}`,
          campo: 'anual',
          valorAnterior: anualDe ? 'anual' : 'no anual',
          valorNuevo: anualA ? 'anual' : 'no anual',
          mes: datos.vigenteDesde,
        })
      }
      cambiados.push({ concepto: cambio.concepto, de, a: cambio.monto, activoDe, activoA, anualDe, anualA })
    }

    // Un gasto fijo cambia lo que pagan los siete a partir de ese mes: desde el
    // panel sí avisa, porque no es una tecla del cierre sino una decisión de
    // administración (`06` §3). Desde el paso 4, no: ver `desdeElCierre`.
    for (const c of desdeElCierre ? [] : cambiados) {
      const desde = nombreMes(comoMes(datos.vigenteDesde))
      /**
       * Un fragmento por cada cosa que cambió, no solo la de mayor prioridad.
       * Antes, reactivar un concepto **y** subirle el monto en la misma
       * llamada avisaba solo "vuelve a cobrarse" y se callaba el aumento; y
       * marcarlo anual sin tocar el monto —pero junto con un cambio de
       * monto— hubiera avisado un "pasó de S/A a S/B" leído como aumento,
       * cuando en realidad es la misma plata dividida distinto.
       */
      const fragmentos: string[] = []
      if (c.activoA !== c.activoDe) {
        fragmentos.push(c.activoA ? 'vuelve a cobrarse' : 'ya no se cobra')
      }
      if (c.anualA !== c.anualDe) {
        fragmentos.push(
          c.anualA ? 'ahora se cobra dividido entre 12 meses' : 'deja de dividirse entre 12 meses',
        )
      }
      if (c.a !== c.de) {
        fragmentos.push(
          c.a === null
            ? 'queda por confirmar'
            : c.de === null
              ? `queda en S/ ${fmt(c.a)}`
              : `pasa de S/ ${fmt(c.de)} a S/ ${fmt(c.a)}`,
        )
      }
      await avisar(tx, {
        tipo: 'gasto_fijo',
        titulo: `${c.concepto} ${fragmentos.join(' y ')} desde ${desde}`,
        detalle: 'Los meses ya cerrados no cambian.',
        mes: datos.vigenteDesde,
      })
    }

    return { cambiados }
  })
}

/**
 * Cambiar gastos fijos **de un solo mes**, dentro de la corrección de un mes
 * publicado. Sin tabla nueva: se apoya en la vigencia que ya existe.
 *
 * Una fila de `GastoFijo` rige «desde» su mes hasta que otra la reemplaza, así
 * que escribir la corrección en `mes` movería también todos los meses de
 * después, publicados o no. Para que sea de ese mes y nada más se escriben dos
 * filas: la corrección en `mes`, y en `mes + 1` una **copia de lo que regía
 * antes**, que devuelve el siguiente mes a su valor. Si `mes + 1` ya tenía fila
 * propia no se toca: esa ya manda.
 *
 * Solo se puede corregir un concepto que ya existe. Un gasto que no estaba en
 * el mes es un gasto puntual, y se añade como tal: un fijo «de un mes» dejaría
 * en la lista de fijos del edificio un concepto apagado desde el mes siguiente.
 *
 * Devuelve los que de verdad cambiaron, con el antes y el después, para que
 * quien llama los cuente en el aviso y en la comprobación de «hay algo que
 * corregir».
 */
export async function ajustarFijosDeUnMes(
  tx: Tx,
  mes: MesId,
  cambios: GuardarGastosFijos['cambios'],
): Promise<
  { concepto: string; de: number | null; a: number | null; activoDe: boolean; activoA: boolean; anualDe: boolean; anualA: boolean }[]
> {
  const siguiente = mesSiguiente(mes)
  const hechos = []

  for (const cambio of cambios) {
    const vigente = await tx.gastoFijo.findFirst({
      where: { concepto: cambio.concepto, vigenteDesde: { lte: mes } },
      orderBy: { vigenteDesde: 'desc' },
    })
    if (!vigente) {
      throw peticionMala(
        `«${cambio.concepto}» no es un gasto fijo de ${nombreMes(mes)}. Un gasto nuevo se añade como gasto puntual.`,
      )
    }
    const de = aNumero(vigente.monto)
    const activoDe = vigente.activo
    const anualDe = vigente.anual
    const activoA = cambio.activo ?? activoDe
    const anualA = cambio.anual ?? anualDe
    if (de === cambio.monto && activoA === activoDe && anualA === anualDe) continue

    // Primero la copia de lo anterior en el mes siguiente, **antes** de escribir
    // la corrección: así lo que se copia es lo que regía, no lo corregido.
    const yaTieneFila = await tx.gastoFijo.findUnique({
      where: { concepto_vigenteDesde: { concepto: cambio.concepto, vigenteDesde: siguiente } },
    })
    if (!yaTieneFila) {
      await tx.gastoFijo.create({
        data: {
          concepto: cambio.concepto,
          monto: vigente.monto,
          anual: anualDe,
          activo: activoDe,
          vigenteDesde: siguiente,
          orden: vigente.orden,
        },
      })
      await auditar(tx, {
        usuario: 'admin', accion: 'crear', entidad: 'gastoFijo',
        entidadId: `${cambio.concepto}@${siguiente}`, campo: 'restauracion',
        valorAnterior: null, valorNuevo: 'vuelve a lo de antes',
        mes,
      })
    }

    await tx.gastoFijo.upsert({
      where: { concepto_vigenteDesde: { concepto: cambio.concepto, vigenteDesde: mes } },
      create: {
        concepto: cambio.concepto,
        monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
        anual: anualA,
        activo: activoA,
        vigenteDesde: mes,
        orden: vigente.orden,
      },
      update: {
        monto: cambio.monto === null ? null : aDecimal2(cambio.monto),
        anual: anualA,
        activo: activoA,
      },
    })

    const id = `${cambio.concepto}@${mes}`
    if (de !== cambio.monto) {
      await auditar(tx, {
        usuario: 'admin', accion: 'corregir', entidad: 'gastoFijo', entidadId: id,
        campo: 'monto', valorAnterior: de, valorNuevo: cambio.monto, mes,
      })
    }
    if (activoA !== activoDe) {
      await auditar(tx, {
        usuario: 'admin', accion: 'corregir', entidad: 'gastoFijo', entidadId: id, campo: 'activo',
        valorAnterior: activoDe ? 'activo' : 'inactivo', valorNuevo: activoA ? 'activo' : 'inactivo', mes,
      })
    }
    if (anualA !== anualDe) {
      await auditar(tx, {
        usuario: 'admin', accion: 'corregir', entidad: 'gastoFijo', entidadId: id, campo: 'anual',
        valorAnterior: anualDe ? 'anual' : 'no anual', valorNuevo: anualA ? 'anual' : 'no anual', mes,
      })
    }
    hechos.push({ concepto: cambio.concepto, de, a: cambio.monto, activoDe, activoA, anualDe, anualA })
  }
  return hechos
}
