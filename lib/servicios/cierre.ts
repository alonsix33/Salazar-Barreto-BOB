/**
 * Las escrituras del cierre del mes.
 *
 * Todas siguen el mismo patrón, en una sola transacción:
 *
 *   1. leer el estado anterior
 *   2. comprobar la versión (bloqueo optimista)
 *   3. escribir el cambio
 *   4. escribir el rastro en `Auditoria`
 *   5. avisar a los siete **solo si el mes ya estaba publicado**
 */

import { prisma } from '@/lib/datos/prisma'
import { aDecimal2, aDecimal3, aNumero, aNumeroObligatorio } from '@/lib/datos/decimal'
import { entradasDeMes, resultadoDeMes, lavadoM3En } from '@/lib/datos/mes'
import { nombreMes } from '@/lib/calculo/mes'
import { enumerar } from '@/lib/formato'
import { fmt } from '@/lib/calculo/redondeo'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import type { MesId, ResultadoMes } from '@/lib/calculo/tipos'
import type { GuardarGastos, GuardarLecturas, GuardarRecibo, Publicar } from '@/lib/esquemas'
import { auditar } from './auditoria'
import { cierreDe, exigirNoPublicado, tomarVersion } from './bloqueo'
import { conflicto, peticionMala } from './errores'
import { enviarPushATodos } from '@/lib/push'

const ADMIN = 'admin'

/** Guardar lecturas del mes. Parcial: se guardan las que vengan. */
export async function guardarLecturas(mes: MesId, datos: GuardarLecturas) {
  return prisma.$transaction(async (tx) => {
    await exigirNoPublicado(tx, mes)
    const version = await tomarVersion(tx, mes, datos.version)

    for (const [dpto, valor] of Object.entries(datos.lecturas)) {
      if (valor === undefined) continue
      const anterior = await tx.lectura.findUnique({ where: { mes_dptoId: { mes, dptoId: dpto } } })
      await tx.lectura.upsert({
        where: { mes_dptoId: { mes, dptoId: dpto } },
        create: { mes, dptoId: dpto, valor: aDecimal3(valor), registradoPor: ADMIN },
        update: { valor: aDecimal3(valor) },
      })
      await auditar(tx, {
        usuario: ADMIN,
        accion: anterior ? 'editar' : 'crear',
        entidad: 'lectura',
        entidadId: `${mes}/${dpto}`,
        campo: 'valor',
        valorAnterior: anterior ? aNumeroObligatorio(anterior.valor) : null,
        valorNuevo: valor,
        mes,
      })
      // Nada de avisos: el mes está en curso. Ver `auditoria.ts`.
    }
    return { version }
  })
}

/** Guardar el recibo. Parcial. `descuento: null` lo borra. */
export async function guardarRecibo(mes: MesId, datos: GuardarRecibo) {
  return prisma.$transaction(async (tx) => {
    await exigirNoPublicado(tx, mes)
    const version = await tomarVersion(tx, mes, datos.version)
    const anterior = await tx.recibo.findUnique({ where: { mes } })

    const nuevo = {
      aguaM3: datos.aguaM3 ?? anterior?.aguaM3 ?? 0,
      aguaMonto: datos.aguaMonto ?? (anterior ? aNumeroObligatorio(anterior.aguaMonto) : 0),
      luz: datos.luz ?? (anterior ? aNumeroObligatorio(anterior.luz) : 0),
      // `undefined` no toca; `null` borra. Es la semántica de `01` §11.
      descuento:
        datos.descuento !== undefined ? datos.descuento : anterior ? aNumero(anterior.descuento) : null,
    }
    if (nuevo.descuento !== null && nuevo.descuento > nuevo.aguaMonto) {
      throw peticionMala(
        'El descuento no puede ser mayor que el monto de la factura: saldría un precio del m³ negativo.',
      )
    }

    await tx.recibo.upsert({
      where: { mes },
      create: {
        mes,
        aguaM3: nuevo.aguaM3,
        aguaMonto: aDecimal2(nuevo.aguaMonto),
        luz: aDecimal2(nuevo.luz),
        descuento: nuevo.descuento === null ? null : aDecimal2(nuevo.descuento),
        registradoPor: ADMIN,
      },
      update: {
        aguaM3: nuevo.aguaM3,
        aguaMonto: aDecimal2(nuevo.aguaMonto),
        luz: aDecimal2(nuevo.luz),
        descuento: nuevo.descuento === null ? null : aDecimal2(nuevo.descuento),
      },
    })

    const antes = {
      aguaM3: anterior?.aguaM3 ?? null,
      aguaMonto: anterior ? aNumeroObligatorio(anterior.aguaMonto) : null,
      luz: anterior ? aNumeroObligatorio(anterior.luz) : null,
      descuento: anterior ? aNumero(anterior.descuento) : null,
    }
    for (const campo of ['aguaM3', 'aguaMonto', 'luz', 'descuento'] as const) {
      if (antes[campo] === nuevo[campo]) continue
      await auditar(tx, {
        usuario: ADMIN,
        accion: anterior ? 'editar' : 'crear',
        entidad: 'recibo',
        entidadId: mes,
        campo,
        valorAnterior: antes[campo],
        valorNuevo: nuevo[campo],
        mes,
      })
    }
    return { version }
  })
}

/** Guardar los gastos puntuales del mes. Reemplaza la lista entera. */
export async function guardarGastos(mes: MesId, datos: GuardarGastos) {
  return prisma.$transaction(async (tx) => {
    await exigirNoPublicado(tx, mes)
    const version = await tomarVersion(tx, mes, datos.version)

    const anteriores = await tx.gastoExtra.findMany({ where: { mes } })
    await tx.gastoExtra.deleteMany({ where: { mes } })
    for (const e of datos.extras) {
      await tx.gastoExtra.create({
        data: {
          mes,
          tipo: e.tipo,
          concepto: e.concepto,
          monto: aDecimal2(e.monto),
          dptoId: e.tipo === 'credito' ? e.dpto : null,
        },
      })
    }
    const resumen = (lista: { tipo: string; concepto: string; monto: unknown; dptoId?: string | null }[]) =>
      lista.map((e) => `${e.tipo} ${e.concepto} ${String(e.monto)}${e.dptoId ? ` → ${e.dptoId}` : ''}`).join(' · ')
    await auditar(tx, {
      usuario: ADMIN,
      accion: 'editar',
      entidad: 'gastoExtra',
      entidadId: mes,
      campo: 'lista',
      valorAnterior: resumen(anteriores),
      valorNuevo: resumen(datos.extras.map((e) => ({ ...e, dptoId: e.tipo === 'credito' ? e.dpto : null }))),
      mes,
    })
    return { version }
  })
}

/**
 * La casilla del lavado del paso 5.
 *
 * Desmarcarla pone `lavadoM3 = 0`: todo el área común vuelve a repartirse entre
 * los siete y el 401 solo paga su medidor. **El total del mes no cambia.**
 */
export async function guardarReasignacion(mes: MesId, activa: boolean, version?: number) {
  return prisma.$transaction(async (tx) => {
    await exigirNoPublicado(tx, mes)
    const nuevaVersion = await tomarVersion(tx, mes, version)

    const reasignacion = await tx.reasignacionAgua.findFirst({ where: { desde: { lte: mes } } })
    if (!reasignacion) throw peticionMala('No hay ninguna reasignación de agua configurada.')

    const anterior = await tx.reasignacionActivaEnMes.findUnique({
      where: { reasignacionId_mes: { reasignacionId: reasignacion.id, mes } },
    })
    await tx.reasignacionActivaEnMes.upsert({
      where: { reasignacionId_mes: { reasignacionId: reasignacion.id, mes } },
      create: { reasignacionId: reasignacion.id, mes, activa },
      update: { activa },
    })
    await auditar(tx, {
      usuario: ADMIN,
      accion: 'editar',
      entidad: 'reasignacionAgua',
      entidadId: `${reasignacion.dptoId}/${mes}`,
      campo: 'activa',
      valorAnterior: anterior ? String(anterior.activa) : null,
      valorNuevo: String(activa),
      mes,
    })
    /**
     * Aquí **no** se avisa, y no por olvido: `exigirNoPublicado` de arriba ya ha
     * lanzado un 409 si el mes estaba publicado, así que un `avisarSiPublicado`
     * en este punto no puede dispararse nunca. Estaba escrito, con sus dos
     * textos, y daba la falsa impresión de que este camino avisaba a alguien.
     *
     * Es correcto que no avise: la casilla es una tecla del paso 5, y de los
     * pasos 1 a 6 los vecinos no se enteran de nada. El aviso sale al publicar.
     */
    return { version: nuevaVersion }
  })
}

/**
 * Guardar el paso en el que se quedó el administrador.
 *
 * No sube la versión —moverse de paso no cambia ningún dato, y hacerlo
 * invalidaría la pestaña de al lado por navegar—, pero **sí deja rastro**: la
 * regla de `06` §3 es que toda escritura se audita, sin excepciones, y ésta no
 * lo hacía. Y sí exige que el mes no esté publicado: un mes cerrado no vuelve
 * al paso 3.
 */
export async function guardarPaso(mes: MesId, paso: number) {
  return prisma.$transaction(async (tx) => {
    await exigirNoPublicado(tx, mes)
    const cierre = await cierreDe(tx, mes)
    if (cierre.paso === paso) return { paso }
    await tx.cierre.update({ where: { mes }, data: { paso } })
    await auditar(tx, {
      usuario: ADMIN,
      accion: 'editar',
      entidad: 'cierre',
      entidadId: mes,
      campo: 'paso',
      valorAnterior: cierre.paso,
      valorNuevo: paso,
      mes,
    })
    return { paso }
  })
}

/**
 * Publicar el mes. El paso 7.
 *
 * Es lo único que hace visible el mes para los siete, y lo primero que genera un
 * aviso. Antes de esto, ningún vecino ve nada.
 */
export async function publicarMes(mes: MesId, datos: Publicar) {
  const resultado = await resultadoDeMes(mes)
  if (!resultado.valido) {
    throw peticionMala(`Este mes todavía no se puede publicar: ${resultado.motivoInvalido}`)
  }
  // La última red de seguridad. `04` §6: el paso 6 bloquea si el cuadre falla.
  if (!resultado.cuadra) {
    throw conflicto('El mes no cuadra, así que no se puede publicar.', {
      cuadraAgua: resultado.cuadraAgua,
      cuadraMes: resultado.cuadraMes,
      cuadraSanidad: resultado.cuadraSanidad,
      motivos: resultado.motivosSanidad,
    })
  }

  const publicado = await prisma.$transaction(async (tx) => {
    const cierre = await cierreDe(tx, mes)

    /**
     * Publicar es **una sola sentencia condicional**, no leer-comparar-escribir.
     *
     * Con `findUnique` y luego `update`, dos publicaciones a la vez —un doble
     * toque en el botón del paso 7 desde un móvil lento— pasaban las dos: dos
     * apuntes de auditoría, la versión subiendo de 2 a 4, y los siete recibiendo
     * «Ya está el cierre de julio» por duplicado. `publicado: false` en el
     * `WHERE` hace que la segunda afecte a cero filas.
     */
    const tomado = await tx.cierre.updateMany({
      where: {
        mes,
        publicado: false,
        ...(datos.version === undefined ? {} : { version: datos.version }),
      },
      data: {
        publicado: true,
        publicadoPor: ADMIN,
        publicadoEn: new Date(),
        paso: 7,
        version: { increment: 1 },
        notaQuePaso: datos.notaQuePaso,
        notaQueCambio: datos.notaQueCambio,
        notaQuePendiente: datos.notaQuePendiente,
        // La única cuota que se guarda: la instantánea de lo que se publicó.
        instantanea: JSON.parse(JSON.stringify(resultado)),
      },
    })
    if (tomado.count === 0) {
      const actual = await tx.cierre.findUnique({
        where: { mes },
        select: { publicado: true, version: true },
      })
      throw conflicto(
        actual?.publicado
          ? 'Este mes ya estaba publicado.'
          : 'Alguien más guardó cambios en este mes. Recarga para ver lo último.',
        { versionEsperada: actual?.version ?? cierre.version, versionRecibida: datos.version },
      )
    }
    /**
     * Se congelan los m³ del lavado con los que se publicó este mes.
     *
     * Sin esto, el valor vivía solo en `ReasignacionAgua.m3` —uno global— y
     * cambiarlo desde el panel movía las cuotas de los meses **ya publicados**:
     * de 1.50 a 3.00 son S/ 6.25 en la cuota de junio del 401, con el aviso a
     * los siete jurando que los meses cerrados no se tocan. Un mes publicado es
     * un hecho: lo que cambie después aplica a los siguientes.
     */
    const reasignacion = await tx.reasignacionAgua.findFirst({ where: { desde: { lte: mes } } })
    if (reasignacion) {
      /**
       * Se congela la **intención** del paso 5, no el resultado.
       *
       * `lavadoM3En` devuelve el precio del m³ si la casilla está marcada para
       * este mes (o heredada del anterior), y 0 solo si se desmarcó a propósito
       * —da igual si el lavado llegó a **caber** en el área común—. Y el precio
       * se congela siempre que la casilla esté marcada, aunque este mes no haya
       * cabido.
       *
       * Antes aquí se grababa `resultado.lavado > 0`, que es el resultado: un
       * mes publicado con la casilla marcada pero con poca área común quedaba
       * `activa:false, m3:null`, y una corrección posterior que restaurara el
       * área común no recuperaba nunca el lavado. Guardando la intención, la
       * corrección re-evalúa si cabe con **el m³ de cuando se publicó**, no con
       * el global de hoy. Un mes desmarcado sigue desmarcado.
       */
      const marcado = (await lavadoM3En(mes, tx)) > 0
      await tx.reasignacionActivaEnMes.upsert({
        where: { reasignacionId_mes: { reasignacionId: reasignacion.id, mes } },
        create: {
          reasignacionId: reasignacion.id,
          mes,
          activa: marcado,
          m3: marcado ? reasignacion.m3 : null,
        },
        update: { activa: marcado, m3: marcado ? reasignacion.m3 : null },
      })
    }

    await auditar(tx, {
      usuario: ADMIN,
      accion: 'publicar',
      entidad: 'cierre',
      entidadId: mes,
      campo: 'publicado',
      valorAnterior: 'false',
      valorNuevo: 'true',
      mes,
    })
    await tx.aviso.create({
      data: {
        tipo: 'mes_publicado',
        titulo: `Ya está el cierre de ${nombreMes(mes)}`,
        detalle: `El mes cerró en S/ ${fmt(resultado.totalMes)}, repartido entre los siete.`,
        mes,
      },
    })
    return { publicado: true, totalMes: resultado.totalMes }
  })

  // Push a los dispositivos suscritos, **después** de confirmar la transacción:
  // un fallo de push no puede tumbar una publicación. Fire-and-forget; sin claves
  // VAPID es un no-op.
  void enviarPushATodos({
    titulo: `Ya está el cierre de ${nombreMes(mes)}`,
    cuerpo: `El mes cerró en S/ ${fmt(publicado.totalMes)}, repartido entre los siete.`,
    url: '/',
  }).catch(() => {})

  return publicado
}

/**
 * Corregir un mes ya publicado.
 *
 * **Está permitido, y deja rastro.** Se recalcula, se avisa a los siete con qué
 * cambió, y queda en auditoría. No hay correcciones silenciosas: es la
 * contrapartida de permitir editar.
 */
export async function corregirMes(
  mes: MesId,
  datos: {
    lecturas?: Record<string, number>
    recibo?: Record<string, number | null>
    motivo: string
    version?: number
  },
) {
  const corregido = await prisma.$transaction(async (tx) => {
    const cierre = await tx.cierre.findUnique({ where: { mes } })
    if (!cierre?.publicado) {
      throw conflicto('Este mes no está publicado: se edita desde el cierre, sin avisar a nadie.')
    }

    /**
     * El "antes" del aviso sale de la **instantánea** que se guardó al publicar
     * (`06` §2): es la cuota que el vecino vio de verdad, no un recálculo. Se
     * mantiene al día —cada corrección la reescribe con su resultado, más abajo—,
     * así que «pasó de X a Y» siempre cita lo último que se le comunicó. Si por lo
     * que sea faltara (nunca debería en un mes publicado), se recalcula dentro de
     * la transacción, que también evita que dos correcciones a la vez citen el
     * mismo «pasó de S/ …».
     */
    const antes =
      (cierre.instantanea as unknown as ResultadoMes | null) ?? (await resultadoDeMes(mes, {}, tx))

    const cambios: { que: string; de: string; a: string; dpto?: string }[] = []

    for (const [dpto, valor] of Object.entries(datos.lecturas ?? {})) {
      const anterior = await tx.lectura.findUnique({ where: { mes_dptoId: { mes, dptoId: dpto } } })
      const de = anterior ? aNumeroObligatorio(anterior.valor) : null
      if (de === valor) continue
      await tx.lectura.upsert({
        where: { mes_dptoId: { mes, dptoId: dpto } },
        create: { mes, dptoId: dpto, valor: aDecimal3(valor), registradoPor: ADMIN },
        update: { valor: aDecimal3(valor) },
      })
      await auditar(tx, {
        usuario: ADMIN, accion: 'corregir', entidad: 'lectura', entidadId: `${mes}/${dpto}`,
        campo: 'valor', valorAnterior: de, valorNuevo: valor, mes,
      })
      cambios.push({
        que: `la lectura del ${dpto}`,
        de: de === null ? '—' : de.toFixed(3),
        a: valor.toFixed(3),
        dpto,
      })
    }

    if (datos.recibo) {
      const anterior = await tx.recibo.findUnique({ where: { mes } })
      if (!anterior) throw peticionMala('No hay recibo que corregir en este mes.')
      const nuevo = {
        aguaM3: (datos.recibo.aguaM3 as number | undefined) ?? anterior.aguaM3,
        aguaMonto: (datos.recibo.aguaMonto as number | undefined) ?? aNumeroObligatorio(anterior.aguaMonto),
        luz: (datos.recibo.luz as number | undefined) ?? aNumeroObligatorio(anterior.luz),
        descuento:
          datos.recibo.descuento !== undefined ? (datos.recibo.descuento as number | null) : aNumero(anterior.descuento),
      }
      if (nuevo.descuento !== null && nuevo.descuento > nuevo.aguaMonto) {
        throw peticionMala('El descuento no puede ser mayor que el monto de la factura.')
      }
      await tx.recibo.update({
        where: { mes },
        data: {
          aguaM3: nuevo.aguaM3,
          aguaMonto: aDecimal2(nuevo.aguaMonto),
          luz: aDecimal2(nuevo.luz),
          descuento: nuevo.descuento === null ? null : aDecimal2(nuevo.descuento),
        },
      })
      const antesRecibo: Record<string, number | null> = {
        aguaM3: anterior.aguaM3,
        aguaMonto: aNumeroObligatorio(anterior.aguaMonto),
        luz: aNumeroObligatorio(anterior.luz),
        descuento: aNumero(anterior.descuento),
      }
      for (const campo of ['aguaM3', 'aguaMonto', 'luz', 'descuento'] as const) {
        if (antesRecibo[campo] === nuevo[campo]) continue
        await auditar(tx, {
          usuario: ADMIN, accion: 'corregir', entidad: 'recibo', entidadId: mes,
          campo, valorAnterior: antesRecibo[campo], valorNuevo: nuevo[campo], mes,
        })
        cambios.push({
          que: `el ${campo === 'aguaM3' ? 'consumo del recibo' : campo === 'aguaMonto' ? 'monto del agua' : campo === 'luz' ? 'recibo de luz' : 'descuento'}`,
          de: String(antesRecibo[campo] ?? '—'),
          a: String(nuevo[campo] ?? '—'),
        })
      }
    }

    if (cambios.length === 0) throw peticionMala('No hay nada que corregir: los valores son los mismos.')

    // Recalcular con lo ya escrito, dentro de la misma transacción.
    // Se recalcula con **la misma** función que usa el resto de la app, leyendo
    // dentro de la transacción para ver lo que se acaba de escribir. Aquí vivía
    // una segunda copia de `entradasDeMes`, y las dos se separaron: la de aquí
    // no heredaba la marca del lavado del mes anterior, así que el aviso a los
    // siete citaba un monto que la app no cobraba.
    const despues = await resultadoDeMes(mes, {}, tx)
    if (!despues.valido || !despues.cuadra) {
      throw conflicto('Con esa corrección el mes deja de cuadrar, así que no se guarda.', {
        motivo: despues.motivoInvalido, motivos: despues.motivosSanidad,
      })
    }

    // El bloqueo optimista, también aquí: dos correcciones a la vez sobre el
    // mismo mes salían las dos bien y cada aviso citaba un "pasó de S/ …" que
    // solo era cierto para la primera.
    await tomarVersion(tx, mes, datos.version)

    // La instantánea queda con el resultado corregido: es la cuota oficial de
    // ahora, y el "antes" de la próxima corrección. Así deja de ser peso muerto.
    await tx.cierre.update({
      where: { mes },
      data: { instantanea: JSON.parse(JSON.stringify(despues)) },
    })

    // El aviso a los siete, con el monto anterior y el nuevo de quien cambió.
    const cambiaron = DPTO_IDS.filter(
      (d) => antes.valido && antes.cuotas[d].total !== despues.cuotas[d].total,
    )
    const detalleCuotas = cambiaron
      .map((d) => `El ${d} pasó de S/ ${fmt(antes.cuotas[d].total)} a S/ ${fmt(despues.cuotas[d].total)}.`)
      .join(' ')
    await tx.aviso.create({
      data: {
        tipo: 'correccion',
        titulo: tituloDeCorreccion(cambios, mes),
        detalle: `${datos.motivo}${detalleCuotas ? ` ${detalleCuotas}` : ' Ninguna cuota cambió de monto.'}`,
        mes,
      },
    })

    return { cambios, cuotasQueCambiaron: cambiaron.length, totalMes: despues.totalMes }
  })

  // Push tras confirmar la transacción. Solo si de verdad cambió alguna cuota:
  // una corrección que no mueve dinero no merece pinchar siete teléfonos.
  if (corregido.cuotasQueCambiaron > 0) {
    void enviarPushATodos({
      titulo: `Se corrigió ${nombreMes(mes)}`,
      cuerpo: 'Tu cuota pudo cambiar. Míralo en la app.',
      url: '/mi-departamento',
    }).catch(() => {})
  }

  return corregido
}

/**
 * El título del aviso de corrección, que leen los siete.
 *
 * Agrupa las lecturas en vez de repetir «la lectura del» una vez por
 * departamento: con `join(' y ')` salía *«la lectura del 202 y la lectura del
 * 301 y la lectura del 401»*. Con dos se leía bien —por eso pasó desapercibido—
 * y con tres, no.
 */
function tituloDeCorreccion(
  cambios: readonly { que: string; dpto?: string }[],
  mes: MesId,
): string {
  const dptos = cambios.filter((c) => c.dpto).map((c) => c.dpto!)
  const otros = cambios.filter((c) => !c.dpto).map((c) => c.que)

  const partes: string[] = []
  if (dptos.length === 1) partes.push(`la lectura del ${dptos[0]}`)
  else if (dptos.length > 1) partes.push(`las lecturas del ${enumerar(dptos)}`)
  partes.push(...otros)

  const verbo = cambios.length === 1 ? 'Se corrigió' : 'Se corrigieron'
  return `${verbo} ${enumerar(partes)} en ${nombreMes(mes)}`
}

export { entradasDeMes }
