/**
 * Listas y vistas agregadas de meses.
 *
 * La lista de meses sale de la base —los meses que tienen recibo— y no de una
 * constante. El prototipo la congelaba en `MESES` porque no tenía backend; en
 * producción el mes en curso es precisamente el que se está cerrando.
 */

import { balancePorDpto, serieSaldo, type MesConPagos } from '@/lib/calculo/saldo'
import { etiquetaMes, mesAnterior, mesCorto, nombreMes, comoMes } from '@/lib/calculo/mes'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import type { DptoId, FilaSaldo, MesId, ResultadoMes } from '@/lib/calculo/tipos'
import { aNumeroObligatorio } from './decimal'
import { entradasDeMes, pagosDe, resultadoDeMes } from './mes'
import { prisma } from './prisma'
import { calcularMes } from '@/lib/calculo/calcularMes'

export interface ResumenMes {
  mes: MesId
  etiqueta: string
  corto: string
  publicado: boolean
  /** El paso del cierre, 0..7. */
  paso: number
  totalMes: number | null
  /** Cuántos de los siete están confirmados. */
  alDia: number
  cuadra: boolean
}

/** Los meses que tienen recibo, del más antiguo al más nuevo. */
export async function mesesConDatos(): Promise<MesId[]> {
  const filas = await prisma.recibo.findMany({ select: { mes: true }, orderBy: { mes: 'asc' } })
  // `comoMes` estrecha y comprueba la cadena de la base (ver su docstring).
  return filas.map((f) => comoMes(f.mes))
}

/**
 * Los meses **publicados**, que son los que ve un vecino.
 *
 * El primero de la lista de recibos suele existir solo para dar la lectura
 * anterior al segundo, así que no tiene por qué estar publicado.
 */
export async function mesesPublicados(): Promise<MesId[]> {
  const filas = await prisma.cierre.findMany({
    where: { publicado: true },
    select: { mes: true },
    orderBy: { mes: 'asc' },
  })
  // `comoMes` estrecha y comprueba la cadena de la base (ver su docstring).
  return filas.map((f) => comoMes(f.mes))
}

/** La lista de meses con su estado, para la pantalla de Historial y la API. */
export async function listaDeMeses(): Promise<ResumenMes[]> {
  const meses = await mesesConDatos()
  const cierres = await prisma.cierre.findMany()
  const porMes = new Map(cierres.map((c) => [c.mes, c]))

  const salida: ResumenMes[] = []
  for (const mes of meses) {
    const [resultado, pagos] = await Promise.all([resultadoDeMes(mes), pagosDe(mes)])
    const cierre = porMes.get(mes)
    salida.push({
      mes,
      etiqueta: etiquetaMes(mes),
      corto: mesCorto(mes),
      publicado: cierre?.publicado ?? false,
      paso: cierre?.paso ?? 0,
      totalMes: resultado.valido ? resultado.totalMes : null,
      alDia: DPTO_IDS.filter((d) => pagos[d]?.estado === 'confirmado').length,
      cuadra: resultado.cuadra,
    })
  }
  return salida
}

/** La serie del saldo, acumulando hacia adelante desde el saldo inicial real. */
export async function serieDelSaldo(): Promise<FilaSaldo[]> {
  const config = await prisma.configuracionEdificio.findUnique({ where: { id: 1 } })
  if (!config) return []
  /**
   * **Solo meses publicados**, no meses con recibo.
   *
   * El saldo es la cuenta conjunta a lo largo de los meses **cerrados**. La
   * auditoría final encontró que esto usaba `mesesConDatos()`, que son los que
   * tienen recibo: en cuanto el paso 2 del cierre guarda el recibo del mes en
   * curso, ese mes entraba en la serie con `recibido = 0` y `gastado = total`,
   * y el saldo daba un salto de miles de soles que Bob recitaba y el Excel
   * exportaba, mientras la pantalla de Inicio —que sí filtra por publicado—
   * enseñaba otra cifra dos centímetros más allá. Inicio e Historial ya
   * filtraban; esto no, y era el único camino que no lo hacía.
   */
  const publicados = await mesesPublicados()
  const meses = publicados.filter((m) => m >= config.mesInicial)
  const conPagos: MesConPagos[] = []
  for (const mes of meses) {
    const [resultado, pagos] = await Promise.all([resultadoDeMes(mes), pagosDe(mes)])
    conPagos.push({ mesId: mes, resultado, pagos })
  }
  return serieSaldo(conPagos, aNumeroObligatorio(config.saldoInicial))
}

/**
 * El balance de un departamento a hoy: lo que trae a favor (pagó de más o por
 * adelantado) o lo que le falta poner, acumulado sobre los meses publicados.
 *
 * Positivo = a favor; negativo = pendiente; 0 = al día. Se calcula sobre los
 * mismos meses cerrados que la cuenta conjunta, así los dos números concuerdan.
 */
export async function balanceDelDpto(dpto: DptoId): Promise<number> {
  const config = await prisma.configuracionEdificio.findUnique({ where: { id: 1 } })
  if (!config) return 0
  const publicados = await mesesPublicados()
  const meses = publicados.filter((m) => m >= config.mesInicial)
  const conPagos: MesConPagos[] = []
  for (const mes of meses) {
    const [resultado, pagos] = await Promise.all([resultadoDeMes(mes), pagosDe(mes)])
    conPagos.push({ mesId: mes, resultado, pagos })
  }
  return balancePorDpto(conPagos)[dpto]
}

export interface Borrador {
  mes: MesId
  etiqueta: string
  paso: number
  version: number
  publicado: boolean
  notaQuePaso: string | null
  notaQueCambio: string | null
  notaQuePendiente: string | null
  /** Lo guardado, ya calculado. */
  resultado: ResultadoMes
  /**
   * Las lecturas **de este mes** que ya están guardadas.
   *
   * Van aparte del `resultado` a propósito: el paso 1 tiene que saber cuántas
   * hay aunque el mes todavía no se pueda calcular. Al principio del cierre no
   * hay recibo, así que `calcularMes` devuelve inválido por eso y ni siquiera
   * llega a mirar las lecturas: derivarlas de ahí hacía que el contador abriera
   * en "7 / 7" con el mes vacío.
   */
  lecturas: Record<string, number>
  /** Las lecturas del mes anterior, para mostrarlas al lado. */
  lecturasAnteriores: Record<string, number>
  /** Promedio histórico de consumo por departamento, para avisar de lo raro. */
  promedios: Record<string, number>
  /**
   * Los m³ que facturó SEDAPAL en los meses anteriores, del más reciente al más
   * antiguo. Los usa Bob en el paso 2 para **comparar**, que es lo que pide
   * `04`: sin ellos, la única frase posible era repetirle al administrador el
   * número que acababa de teclear.
   */
  m3Anteriores: { mes: string; m3: number }[]
  /** El monto de luz de los meses anteriores, para que Bob compare en el paso 3. */
  luzAnteriores: { mes: string; luz: number }[]
  /** La cuota de cada dpto en el mes anterior publicado, para el paso 6. `null` si no hay. */
  cuotasAnteriores: Record<string, number> | null
  /** Los m³ del lavado configurados y si está activo este mes. */
  lavado: { m3: number; activo: boolean; aplicado: boolean; dpto: string; concepto: string } | null
}

/** Todo lo que el cierre del mes necesita para pintarse. */
export async function borradorDeMes(mes: MesId): Promise<Borrador> {
  const cierre = await prisma.cierre.findUnique({ where: { mes } })
  const entradas = await entradasDeMes(mes)
  const resultado = calcularMes(entradas)

  /**
   * La cuota de cada dpto el mes anterior, para que el paso 6 muestre cuánto se
   * movió cada una antes de publicar a siete hogares. `04` §Paso 6 la pinta como
   * cuarta columna, ámbar si sube y verde si baja. Solo si el mes anterior está
   * publicado: comparar contra un borrador a medias no dice nada.
   */
  const anterior = mesAnterior(mes)
  const cierreAnterior = await prisma.cierre.findUnique({ where: { mes: anterior } })
  let cuotasAnteriores: Record<string, number> | null = null
  if (cierreAnterior?.publicado) {
    const rAnt = await resultadoDeMes(anterior)
    if (rAnt.valido) {
      cuotasAnteriores = Object.fromEntries(DPTO_IDS.map((d) => [d, rAnt.cuotas[d].total]))
    }
  }

  const reasignacion = await prisma.reasignacionAgua.findFirst({
    where: { desde: { lte: mes } },
    include: { activaEn: true },
  })

  return {
    mes,
    etiqueta: etiquetaMes(mes),
    paso: cierre?.paso ?? 0,
    version: cierre?.version ?? 0,
    publicado: cierre?.publicado ?? false,
    notaQuePaso: cierre?.notaQuePaso ?? null,
    notaQueCambio: cierre?.notaQueCambio ?? null,
    notaQuePendiente: cierre?.notaQuePendiente ?? null,
    resultado,
    // `Lecturas` es `Partial<Record<DptoId, number>>`; el borrador las expone
    // como diccionario llano para la interfaz, que las lee por id de dpto.
    lecturas: entradas.lecturas as Record<string, number>,
    lecturasAnteriores: entradas.lecturasAnteriores as Record<string, number>,
    promedios: await promediosDeConsumo(mes),
    m3Anteriores: await m3DeLosMesesAnteriores(mes),
    luzAnteriores: await luzDeLosMesesAnteriores(mes),
    cuotasAnteriores,
    lavado: reasignacion
      ? {
          m3: aNumeroObligatorio(reasignacion.m3),
          // `activo` es el interruptor: lo que el administrador dejó marcado.
          activo: entradas.lavadoM3 > 0,
          // `aplicado` es lo que de verdad pasó. `01` §3.3: el lavado puede estar
          // activado y aun así no aplicarse si no hay bastante área común de
          // donde sacarlo, o si el mes va en reparto ajustado. Cuando eso pasa,
          // «la app lo dice explícitamente en pantalla», y para decirlo hay que
          // distinguir las dos cosas: querer aplicarlo y haberlo aplicado.
          aplicado: resultado.lavado > 0,
          dpto: reasignacion.dptoId,
          concepto: reasignacion.concepto,
        }
      : null,
  }
}

/**
 * Los m³ de SEDAPAL de los dos meses anteriores, para que Bob compare.
 *
 * Dos y no más: `04` los enseña así —*«junio fueron 78 y mayo 78»*— y una lista
 * larga deja de leerse. Si no hay ninguno, se devuelve vacío y Bob lo dice en
 * vez de inventar una comparación.
 */
export async function m3DeLosMesesAnteriores(
  hasta: MesId,
): Promise<{ mes: string; m3: number }[]> {
  const filas = await prisma.recibo.findMany({
    where: { mes: { lt: hasta } },
    orderBy: { mes: 'desc' },
    take: 2,
    select: { mes: true, aguaM3: true },
  })
  return filas.map((f) => ({ mes: nombreMes(comoMes(f.mes)), m3: f.aguaM3 }))
}

/**
 * El monto del recibo de luz de los dos meses anteriores, para que Bob compare
 * en el paso 3. `04` §Paso 3: «Bob compara con el mes anterior».
 */
export async function luzDeLosMesesAnteriores(
  hasta: MesId,
): Promise<{ mes: string; luz: number }[]> {
  const filas = await prisma.recibo.findMany({
    where: { mes: { lt: hasta } },
    orderBy: { mes: 'desc' },
    take: 2,
    select: { mes: true, luz: true },
  })
  return filas.map((f) => ({ mes: nombreMes(comoMes(f.mes)), luz: aNumeroObligatorio(f.luz) }))
}

/**
 * Promedio de consumo de cada departamento en los meses anteriores.
 *
 * Lo usa el paso 1 para pintar en ámbar una lectura que se sale de lo normal, y
 * `proponerCorreccion` para descartar candidatas absurdas.
 */
export async function promediosDeConsumo(hasta: MesId): Promise<Record<string, number>> {
  const meses = (await mesesConDatos()).filter((m) => m < hasta)
  const suma: Record<string, number> = {}
  const cuenta: Record<string, number> = {}
  for (const mes of meses) {
    const r = await resultadoDeMes(mes)
    if (!r.valido) continue
    for (const d of DPTO_IDS) {
      suma[d] = (suma[d] ?? 0) + r.consumos[d]
      cuenta[d] = (cuenta[d] ?? 0) + 1
    }
  }
  const salida: Record<string, number> = {}
  for (const d of DPTO_IDS) salida[d] = cuenta[d] ? suma[d]! / cuenta[d]! : 0
  return salida
}
