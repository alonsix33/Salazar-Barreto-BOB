/**
 * La foto del edificio: **una sola tanda de consultas para todo**.
 *
 * ## Por qué existe
 *
 * Lo de antes leía mes a mes. `balanceDelDpto()` más `historialDeDpto()` hacían
 * 91 consultas; `listaDeMeses()`, 66; la serie del saldo, 26. Con la base al
 * lado eso son 57 ms y no se nota. Con la app en Vercel y la base en Railway
 * cada consulta es un viaje por internet, y con `?connection_limit=1` —que es
 * lo que recomienda Prisma para serverless— ni siquiera van en paralelo: van
 * una detrás de otra. Medido en producción: Inicio 12.3 s, Mi departamento
 * 31.8 s, Historial 39.4 s. No era el cálculo: era la fila de viajes.
 *
 * Aquí se leen **las siete tablas enteras, de una vez**, y los meses se
 * calculan en memoria con el mismo motor de siempre. El edificio tiene siete
 * departamentos y una docena de meses: la base entera son unas trescientas
 * filas. Traerlas todas cuesta menos que preguntar por una.
 *
 * ## Lo que NO cambia
 *
 * `06` §2 sigue en pie: **no se guarda ninguna cuota calculada**. Esto no lee
 * `Cierre.instantanea` para mostrar nada; lee las entradas —lecturas, recibos,
 * gastos, pagos— y llama a `calcularMes` igual que antes. Si mañana se corrige
 * una lectura de mayo, todo lo derivado se recalcula solo, como siempre.
 *
 * ## La caché
 *
 * La tanda de consultas va envuelta en `unstable_cache` con la etiqueta
 * `edificio`, y **cualquier escritura que pase por Prisma la tira** (ver
 * `prisma.ts`). Así los números están siempre al día sin preguntar a la base en
 * cada pulsación. El `revalidate` de abajo es solo una red de seguridad por si
 * un día se escribe por fuera de la app —desde la consola de Railway, por
 * ejemplo—: pasado ese tiempo se vuelve a leer aunque nadie haya avisado.
 */

import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { calcularMes } from '@/lib/calculo/calcularMes'
import { mesAnterior, comoMes } from '@/lib/calculo/mes'
import type {
  DptoId,
  EntradasMes,
  Extra,
  GastoFijo,
  Lecturas,
  MesId,
  PagosMes,
  Recibo,
  ResultadoMes,
} from '@/lib/calculo/tipos'
import { aNumero, aNumeroObligatorio } from './decimal'
import { TAG_EDIFICIO } from './etiquetas'
import { prisma } from './prisma'

/**
 * Cada cuánto se vuelve a leer aunque nadie haya avisado de un cambio.
 *
 * Cinco minutos. No es el mecanismo principal —las escrituras invalidan al
 * instante—: es el que cubre el caso de que alguien toque la base por fuera.
 */
const RED_DE_SEGURIDAD_S = 300

/* ------------------------------------------------------------------ crudos */

/**
 * Las filas tal como salen de la base, ya sin `Decimal` ni `Date`.
 *
 * Todo es JSON llano a propósito: esto es lo que entra y sale de
 * `unstable_cache`, que serializa. Un `Decimal` o un `Date` volverían del otro
 * lado convertidos en otra cosa, y el fallo aparecería en una cuota, no aquí.
 */
export interface Crudos {
  recibos: { mes: string; aguaM3: number; aguaMonto: number; descuento: number | null; luz: number }[]
  lecturas: { mes: string; dptoId: string; valor: number }[]
  fijos: { concepto: string; monto: number | null; anual: boolean; vigenteDesde: string; orden: number }[]
  extras: {
    mes: string
    tipo: 'gasto' | 'credito'
    concepto: string
    monto: number
    dptoId: string | null
    participantes: string[]
    reparto: 'porcentaje' | 'iguales'
  }[]
  reasignaciones: {
    dptoId: string
    concepto: string
    m3: number
    desde: string
    activaEn: { mes: string; activa: boolean; m3: number | null }[]
  }[]
  pagos: {
    mes: string
    dptoId: string
    estado: 'confirmado' | 'aviso'
    fecha: string
    monto: number | null
    operacion: string | null
    texto: string | null
  }[]
  cierres: {
    mes: string
    publicado: boolean
    paso: number
    version: number
    notaQuePaso: string | null
    notaQueCambio: string | null
    notaQuePendiente: string | null
  }[]
  config: { saldoInicial: number; mesInicial: string } | null
}

/** Las siete tablas, enteras, en una sola tanda. */
async function leerCrudos(): Promise<Crudos> {
  const [recibos, lecturas, fijos, extras, reasignaciones, pagos, cierres, config] =
    await Promise.all([
      prisma.recibo.findMany({ orderBy: { mes: 'asc' } }),
      prisma.lectura.findMany(),
      /**
       * El mismo orden que usaba `fijosVigentesEn`: por `orden` y, dentro, por
       * vigencia ascendente. El filtro por mes se hace luego en memoria y la
       * última fila de cada concepto gana, que es la más reciente que aplica.
       */
      prisma.gastoFijo.findMany({ orderBy: [{ orden: 'asc' }, { vigenteDesde: 'asc' }] }),
      /**
       * `id` como desempate, que antes no estaba.
       *
       * Ordenar solo por `creadoEn` deja el orden de dos gastos creados en el
       * mismo milisegundo a lo que decida Postgres, y el orden de los extras sí
       * puede mover un céntimo en el reparto. Esto es más determinista que
       * antes, no menos.
       */
      prisma.gastoExtra.findMany({ orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] }),
      /**
       * Con orden, que antes no lo tenía.
       *
       * `lavadoM3En` usaba `findFirst` sin `orderBy`: con una sola reasignación
       * —que es lo que hay— da igual, pero el día que haya dos leería una al
       * azar. Se ordena como la ruta que las edita (`PUT /api/reasignaciones`,
       * `[desde desc, creadoEn desc]`) para que la que se lee sea la que se
       * escribe.
       */
      prisma.reasignacionAgua.findMany({
        orderBy: [{ desde: 'desc' }, { creadoEn: 'desc' }],
        include: { activaEn: true },
      }),
      prisma.pago.findMany(),
      prisma.cierre.findMany({ orderBy: { mes: 'asc' } }),
      prisma.configuracionEdificio.findUnique({ where: { id: 1 } }),
    ])

  return {
    recibos: recibos.map((r) => ({
      mes: r.mes,
      aguaM3: r.aguaM3,
      aguaMonto: aNumeroObligatorio(r.aguaMonto),
      descuento: aNumero(r.descuento),
      luz: aNumeroObligatorio(r.luz),
    })),
    lecturas: lecturas.map((l) => ({
      mes: l.mes,
      dptoId: l.dptoId,
      valor: aNumeroObligatorio(l.valor),
    })),
    fijos: fijos.map((f) => ({
      concepto: f.concepto,
      monto: aNumero(f.monto),
      anual: f.anual,
      vigenteDesde: f.vigenteDesde,
      orden: f.orden,
    })),
    extras: extras.map((e) => ({
      mes: e.mes,
      tipo: e.tipo,
      concepto: e.concepto,
      monto: aNumeroObligatorio(e.monto),
      dptoId: e.dptoId,
      participantes: e.participantes,
      reparto: e.reparto,
    })),
    reasignaciones: reasignaciones.map((r) => ({
      dptoId: r.dptoId,
      concepto: r.concepto,
      m3: aNumeroObligatorio(r.m3),
      desde: r.desde,
      activaEn: r.activaEn.map((a) => ({ mes: a.mes, activa: a.activa, m3: aNumero(a.m3) })),
    })),
    pagos: pagos.map((p) => ({
      mes: p.mes,
      dptoId: p.dptoId,
      estado: p.estado,
      fecha: p.fecha.toISOString().slice(0, 10),
      monto: aNumero(p.monto),
      operacion: p.operacion,
      texto: p.texto,
    })),
    cierres: cierres.map((c) => ({
      mes: c.mes,
      publicado: c.publicado,
      paso: c.paso,
      version: c.version,
      notaQuePaso: c.notaQuePaso,
      notaQueCambio: c.notaQueCambio,
      notaQuePendiente: c.notaQuePendiente,
    })),
    config: config
      ? { saldoInicial: aNumeroObligatorio(config.saldoInicial), mesInicial: config.mesInicial }
      : null,
  }
}

/* ------------------------------------------------------------- el almanaque */

export interface CierreVisto {
  mes: MesId
  publicado: boolean
  paso: number
  version: number
  notaQuePaso: string | null
  notaQueCambio: string | null
  notaQuePendiente: string | null
}

/** La foto del edificio, con los meses ya calculables sin tocar la base. */
export interface Almanaque {
  crudos: Crudos
  /** Los meses que tienen recibo, del más antiguo al más nuevo. */
  mesesConRecibo: MesId[]
  /** Los meses publicados, del más antiguo al más nuevo. */
  mesesPublicados: MesId[]
  config: { saldoInicial: number; mesInicial: string } | null
  cierreDe(mes: MesId): CierreVisto | null
  entradasDe(mes: MesId): EntradasMes
  /** El mes calculado con el motor de siempre. Se calcula una vez por foto. */
  resultadoDe(mes: MesId): ResultadoMes
  pagosDe(mes: MesId): PagosMes
}

export function construir(crudos: Crudos): Almanaque {
  const lecturasPorMes = new Map<string, Lecturas>()
  for (const l of crudos.lecturas) {
    let m = lecturasPorMes.get(l.mes)
    if (!m) lecturasPorMes.set(l.mes, (m = {}))
    m[l.dptoId as DptoId] = l.valor
  }

  const pagosPorMes = new Map<string, PagosMes>()
  for (const p of crudos.pagos) {
    let m = pagosPorMes.get(p.mes)
    if (!m) pagosPorMes.set(p.mes, (m = {}))
    m[p.dptoId as DptoId] = {
      estado: p.estado,
      fecha: p.fecha,
      monto: p.monto,
      op: p.operacion,
      texto: p.texto,
    }
  }

  const extrasPorMes = new Map<string, Extra[]>()
  for (const e of crudos.extras) {
    const lista = extrasPorMes.get(e.mes) ?? []
    lista.push(
      e.tipo === 'credito'
        ? { tipo: 'credito', concepto: e.concepto, monto: e.monto, dpto: e.dptoId as DptoId }
        : {
            tipo: 'gasto',
            concepto: e.concepto,
            monto: e.monto,
            participantes: e.participantes as DptoId[],
            reparto: e.reparto,
          },
    )
    extrasPorMes.set(e.mes, lista)
  }

  const recibosPorMes = new Map<string, Recibo>()
  for (const r of crudos.recibos) {
    recibosPorMes.set(r.mes, {
      aguaM3: r.aguaM3,
      aguaMonto: r.aguaMonto,
      luz: r.luz,
      descuento: r.descuento,
    })
  }

  const cierresPorMes = new Map<string, Crudos['cierres'][number]>()
  for (const c of crudos.cierres) cierresPorMes.set(c.mes, c)

  /** Igual que `fijosVigentesEn`, pero sobre las filas ya en memoria. */
  function fijosEn(mes: MesId): GastoFijo[] {
    const porConcepto = new Map<string, Crudos['fijos'][number]>()
    // `crudos.fijos` ya viene ordenado por [orden, vigenteDesde]: la última que
    // aplica a este mes es la más reciente, y es la que gana.
    for (const f of crudos.fijos) if (f.vigenteDesde <= mes) porConcepto.set(f.concepto, f)
    return [...porConcepto.values()]
      .sort((a, b) => a.orden - b.orden || a.concepto.localeCompare(b.concepto))
      .map((f) => ({
        concepto: f.concepto,
        monto: f.monto,
        ...(f.anual ? { anual: true } : {}),
        ...(f.monto === null ? { porConfirmar: true } : {}),
      }))
  }

  /** Igual que `lavadoM3En`, con la misma herencia y el mismo congelado. */
  function lavadoEn(mes: MesId): number {
    const r = crudos.reasignaciones.find((x) => x.desde <= mes)
    if (!r) return 0
    const vigente = (congelado: number | null | undefined) =>
      congelado === null || congelado === undefined ? r.m3 : congelado
    const marca = r.activaEn.find((a) => a.mes === mes)
    if (marca) return marca.activa ? vigente(marca.m3) : 0
    const anterior = r.activaEn.find((a) => a.mes === mesAnterior(mes))
    if (anterior) return anterior.activa ? r.m3 : 0
    return r.m3
  }

  function entradasDe(mes: MesId): EntradasMes {
    return {
      mesId: mes,
      recibo: recibosPorMes.get(mes) ?? null,
      lecturas: lecturasPorMes.get(mes) ?? {},
      lecturasAnteriores: lecturasPorMes.get(mesAnterior(mes)) ?? {},
      fijos: fijosEn(mes),
      extras: extrasPorMes.get(mes) ?? [],
      lavadoM3: lavadoEn(mes),
    }
  }

  const calculados = new Map<string, ResultadoMes>()
  function resultadoDe(mes: MesId): ResultadoMes {
    let r = calculados.get(mes)
    if (!r) calculados.set(mes, (r = calcularMes(entradasDe(mes))))
    return r
  }

  return {
    crudos,
    // `comoMes` estrecha y comprueba la cadena de la base (ver su docstring).
    mesesConRecibo: crudos.recibos.map((r) => comoMes(r.mes)),
    mesesPublicados: crudos.cierres.filter((c) => c.publicado).map((c) => comoMes(c.mes)),
    config: crudos.config,
    cierreDe(mes) {
      const c = cierresPorMes.get(mes)
      return c ? { ...c, mes: comoMes(c.mes) } : null
    },
    entradasDe,
    resultadoDe,
    pagosDe: (mes) => pagosPorMes.get(mes) ?? {},
  }
}

/* ----------------------------------------------------------------- la caché */

/**
 * ¿Estamos dentro del servidor de Next?
 *
 * Fuera de él —vitest, los scripts de siembra, la consola— no hay caché de
 * datos ni `revalidateTag` que valga, así que se lee directo. Envolver ahí no
 * rompería nada, pero dejaría los tests de integración leyendo una foto vieja
 * después de escribir, que es justo lo que no queremos comprobar.
 */
function dentroDeNext(): boolean {
  return Boolean(process.env.NEXT_RUNTIME)
}

const leerCrudosCacheado = unstable_cache(leerCrudos, ['edificio:crudos:v1'], {
  tags: [TAG_EDIFICIO],
  revalidate: RED_DE_SEGURIDAD_S,
})

/**
 * La foto del edificio **sin pasar por la caché entre peticiones**.
 *
 * Es la que usan las pantallas de administración. Quien está cerrando el mes
 * acaba de escribir y tiene que ver lo que escribió: la invalidación por
 * etiqueta ocurre dentro de la transacción, así que entre el `revalidateTag` y
 * el commit hay una rendija —milisegundos— en la que otra lectura podría
 * repoblar la caché con lo de antes. Para un vecino da igual; para quien está
 * tecleando, no. Sigue siendo una sola tanda de consultas, que es lo que
 * importaba: rápido, y sin nada que razonar sobre carreras.
 */
export async function almanaqueFresco(): Promise<Almanaque> {
  return construir(await leerCrudos())
}

async function construirFoto(): Promise<Almanaque> {
  return construir(dentroDeNext() ? await leerCrudosCacheado() : await leerCrudos())
}

/**
 * La foto del edificio para esta petición.
 *
 * Dentro de Next, `cache()` de React la memoriza **durante una misma
 * petición**: Inicio pide la serie del saldo y el mes actual, y las dos salen
 * de la misma foto sin volver a construirla. `unstable_cache` la memoriza
 * **entre peticiones**, hasta que alguien escriba.
 *
 * Fuera de Next —vitest, los scripts— no se memoriza nada, a propósito: los
 * tests de integración escriben y vuelven a leer esperando lo nuevo, y una
 * memorización silenciosa los dejaría comprobando una foto vieja. Es la clase
 * de test que pasa siempre y no vigila nada.
 */
export const almanaque: () => Promise<Almanaque> = dentroDeNext()
  ? cache(construirFoto)
  : construirFoto

/** Para los tests y los scripts que quieran las filas sin montar. */
export { leerCrudos }
