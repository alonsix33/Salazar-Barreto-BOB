/**
 * El motor de cálculo. `01-reglas-de-negocio.md` es la especificación.
 *
 * Port literal de `calcularMes()` de `mockup/datos-edificio.js`, con el mismo
 * orden de operaciones y los mismos puntos de redondeo. **No mover un `round2`
 * de sitio**: el cuadre depende de dónde cae cada uno.
 *
 * Función pura: mismas entradas, mismas salidas. No lee la base de datos, no
 * mira el reloj y no tiene efectos. Por eso el mismo código corre en el
 * servidor al publicar y en el cliente mientras el administrador teclea.
 */

import {
  CONCEPTO_AGUA,
  CONCEPTO_LUZ,
  DPTOS,
  LAVADO,
  ORDEN_GASTOS,
  TOLERANCIA_M3,
  toleranciaAgua,
  toleranciaMes,
} from './constantes'
import { esMesId } from './mes'
import { round2 } from './redondeo'
import { revisarEntradas, revisarResultado, sumarMontos } from './sanidad'
import type {
  CuotaDpto,
  DptoId,
  EntradasMes,
  LineaGasto,
  Overrides,
  PorDpto,
  Recibo,
  ResultadoMes,
} from './tipos'

const RECIBO_VACIO: Recibo = { aguaM3: 0, aguaMonto: 0, luz: 0, descuento: null }

/** Resultado marcado como inválido. Nunca `null`, nunca `NaN`. */
function invalido(
  mesId: ResultadoMes['mesId'],
  rec: Recibo,
  motivo: string,
  dptosSinLectura: readonly DptoId[] = [],
): ResultadoMes {
  // `as`: `Object.fromEntries` devuelve `{[k: string]: T}`; aquí las claves son
  // exactamente los siete ids de `DPTOS`, que es lo que `PorDpto` afirma.
  const cero = <T>(v: T): PorDpto<T> =>
    Object.fromEntries(DPTOS.map((d) => [d.id, v])) as PorDpto<T>
  const cuotaCero: CuotaDpto = {
    mantenimiento: 0, agua: 0, credito: 0, total: 0,
    m3: 0, m3medidos: 0, lavado: 0, lecturaAnterior: 0, lecturaActual: 0,
  }
  return {
    mesId,
    valido: false,
    motivoInvalido: motivo,
    dptosSinLectura,
    rec,
    consumos: cero(0),
    sumaMedida: 0,
    facturaAgua: 0,
    precioM3: 0,
    brutoComun: 0,
    comunReal: 0,
    lavado: 0,
    ajustado: false,
    factor: 1,
    montoComun: 0,
    gastos: [],
    totalMes: 0,
    baseMant: 0,
    // `as`: mismo motivo que arriba, se construye recorriendo los siete DPTOS.
    cuotas: Object.fromEntries(
      DPTOS.map((d) => [d.id, { ...cuotaCero }]),
    ) as PorDpto<CuotaDpto>,
    sumaAgua: 0,
    sumaCuotas: 0,
    totalCreditos: 0,
    cuadraAgua: false,
    cuadraM3: false,
    sumaM3Cobrados: 0,
    cuadraMes: false,
    cuadraSanidad: false,
    motivosSanidad: [motivo],
    cuadra: false,
    descuento: 0,
  }
}

/**
 * Calcula un mes completo.
 *
 * @param entradas Lo guardado: recibo, lecturas del mes y del anterior, gastos
 *                 fijos vigentes, extras y los m³ del lavado configurados.
 * @param ov       Lo que el administrador está escribiendo y aún no guardó.
 *                 Cada campo pisa la entrada guardada individualmente.
 */
export function calcularMes(entradasCrudas: EntradasMes, ovCruda: Overrides = {}): ResultadoMes {
  // Normalización defensiva. Zod corta esto en el borde de la API, pero el
  // motor también corre en el navegador y recibe lo que devuelve la base: un
  // `findMany` sin filas dejaba `fijos` en `null` y `calcularMes` lanzaba un
  // TypeError en medio del cierre del mes.
  const entradas: EntradasMes = {
    ...entradasCrudas,
    lecturas: entradasCrudas?.lecturas ?? {},
    lecturasAnteriores: entradasCrudas?.lecturasAnteriores ?? {},
    fijos: entradasCrudas?.fijos ?? [],
    extras: entradasCrudas?.extras ?? [],
  }
  const ov: Overrides = ovCruda ?? {}
  const { mesId } = entradas

  if (!esMesId(mesId)) {
    return invalido(mesId, RECIBO_VACIO, `El mes "${String(mesId)}" no tiene la forma AAAA-MM.`)
  }

  // ── Recibo efectivo: lo escrito pisa lo guardado, campo por campo
  const base = entradas.recibo
  /**
   * `01` §11: "cada campo pisa la semilla individualmente".
   *
   * `undefined` significa "no lo estoy tocando" y cae a lo guardado; `null`
   * significa "este mes no hay" y lo borra. Con `??` encadenado los dos se
   * comportaban igual, así que un mes sin descuento heredaba el del mes
   * guardado: S/ 17.33 que el edificio dejaba de cobrar, con los dos cuadres
   * en verde.
   */
  const pisa = <T,>(escrito: T | undefined, guardado: T | undefined, porDefecto: T): T =>
    escrito !== undefined ? escrito : (guardado ?? porDefecto)
  const rec: Recibo = {
    aguaM3: pisa(ov.recibo?.aguaM3, base?.aguaM3, 0),
    aguaMonto: pisa(ov.recibo?.aguaMonto, base?.aguaMonto, 0),
    luz: pisa(ov.recibo?.luz, base?.luz, 0),
    descuento: pisa(ov.recibo?.descuento, base?.descuento, null),
  }

  const problema = revisarEntradas(entradas, ov)
  if (problema) return invalido(mesId, rec, problema)

  if (!base && !ov.recibo) {
    return invalido(mesId, rec, 'Todavía no se registró el recibo de este mes.')
  }

  // Sin las lecturas del mes anterior no hay consumo que calcular.
  const faltantesAnteriores = DPTOS.filter(
    (d) => entradas.lecturasAnteriores[d.id] == null,
  ).map((d) => d.id)
  if (faltantesAnteriores.length > 0) {
    return invalido(
      mesId,
      rec,
      `Faltan las lecturas del mes anterior de ${faltantesAnteriores.join(', ')}.`,
      faltantesAnteriores,
    )
  }

  // Dividir entre los m³ facturados: sin ellos no hay precio por m³.
  // `Number.isFinite` además de `> 0`: `Infinity > 0` es verdadero y se colaba,
  // dejando `montoComun` en NaN dentro de un resultado marcado como válido.
  if (!(Number.isFinite(rec.aguaM3) && rec.aguaM3 > 0)) {
    return invalido(
      mesId,
      rec,
      'El recibo de SEDAPAL no tiene m³ facturados, así que no hay precio por m³ que repartir.',
    )
  }

  // ── Lecturas efectivas del mes.
  //
  // Si falta alguna, el mes **no se puede calcular**. Arrastrar la lectura del
  // mes anterior daría consumo 0 para ese departamento, su agua saldría en
  // S/ 0.00, esos m³ se irían al área común —que la pagan los siete desde el
  // saldo— y los dos cuadres seguirían dando verdadero, porque se comparan
  // contra su propia `sumaMedida` y no pueden ver una lectura que no está.
  // El paso 6 del cierre dejaría publicar un mes mal cobrado con luz verde.
  // Medido: sin la lectura del 502 en junio, el 502 dejaba de pagar S/ 70.25 y
  // el área común pasaba de S/ 6.75 a S/ 77.00.
  //
  // `as`: el tipo declarado es parcial, pero justo arriba se comprobó que los
  // siete departamentos tienen lectura anterior.
  const lecAnt = entradas.lecturasAnteriores as Record<DptoId, number>
  const faltanLecturas = DPTOS.filter(
    (d) => (ov.lecturas?.[d.id] ?? entradas.lecturas[d.id]) == null,
  ).map((d) => d.id)
  if (faltanLecturas.length > 0) {
    return invalido(mesId, rec, `Faltan las lecturas de ${faltanLecturas.join(', ')}.`, faltanLecturas)
  }
  // `as`: se recorre `DPTOS` y justo arriba se comprobó que los siete tienen
  // lectura, así que las siete claves están y ninguna es `undefined`.
  const lecAct: PorDpto<number> = Object.fromEntries(
    DPTOS.map((d) => [d.id, (ov.lecturas?.[d.id] ?? entradas.lecturas[d.id])!]),
  ) as PorDpto<number>

  // ── Consumo medido · §3.1
  // `as`: acumuladores que el bucle de justo abajo rellena para los siete.
  const consumos = {} as PorDpto<number>
  let sumaMedida = 0
  for (const d of DPTOS) {
    const c = round2(lecAct[d.id] - lecAnt[d.id])
    consumos[d.id] = c
    sumaMedida += c
  }
  sumaMedida = round2(sumaMedida)

  // ── El agua · §2.2 y §3.2
  const facturaAgua = round2(rec.aguaMonto - (rec.descuento ?? 0))
  // precioM3 NO se redondea: se arrastra a precisión completa. Redondear el
  // precio unitario descuadra el total.
  const precioM3 = facturaAgua / rec.aguaM3
  /**
   * **El precio por m³ tiene que ser un número, y `aguaM3 > 0` no lo garantiza.**
   *
   * La guarda de arriba exige `aguaM3` finito y mayor que cero, y eso deja
   * pasar los denormales: con `aguaM3 = 5e-324` —el número positivo más
   * pequeño que existe en coma flotante— la división da `Infinity`, y el mes
   * salía marcado como **válido** con un precio infinito dentro. Lo encontró la
   * batería en la corrida 159; a mano no se le ocurre a nadie, y un recibo mal
   * tecleado con un exponente puede producirlo.
   *
   * Se comprueba lo que de verdad tiene que valer, que es el resultado de la
   * división, en vez de adivinar un mínimo de m³ que lo evite.
   */
  if (!Number.isFinite(precioM3)) {
    return invalido(
      mesId,
      rec,
      'Los m³ del recibo son demasiado pequeños para repartir la factura entre ellos. Revisa el recibo de SEDAPAL.',
    )
  }
  const brutoComun = round2(rec.aguaM3 - sumaMedida)

  // ── Reparto ajustado · §3.4 · los medidores midieron más de lo facturado
  const ajustado = brutoComun < 0
  const factor = ajustado ? rec.aguaM3 / sumaMedida : 1

  // ── El lavado sale del caño común: se reasigna, no se suma · §3.3
  // `?? LAVADO.m3`: un `null` que se cuele desde la base no puede desactivar el
  // lavado en silencio. Un 0 explícito sí lo desactiva, que es lo que hace la
  // casilla del paso 5.
  const lavM3 = ov.lavadoM3 ?? entradas.lavadoM3 ?? LAVADO.m3
  const lavado =
    !ajustado && lavM3 > 0 && brutoComun >= lavM3 && mesId >= LAVADO.desde ? lavM3 : 0
  /**
   * **En el reparto ajustado no hay área común: es 0, no un número negativo.**
   *
   * Cuando los medidores miden más de lo que facturó SEDAPAL no sobra agua que
   * repartir, sobra medición. El código ya lo sabía a medias —`montoComun` se
   * fuerza a 0 tres líneas más abajo— pero dejaba `comunReal` en negativo, y
   * eso tenía dos consecuencias de verdad: la hoja «De dónde sale cada monto»
   * le enseñaba al vecino un área común de −4.98 m³, y el tercer cuadre lo leía
   * como cifra imposible y **bloqueaba la publicación de un mes correcto**.
   *
   * `brutoComun` se conserva tal cual, en negativo, porque es la diferencia
   * cruda y es justo el dato que dice cuánto midieron de más.
   *
   * Esto **no mueve un céntimo**: `montoComun` ya era 0 y los m³ de cada
   * departamento salen de `consumos · factor`, que no toca `comunReal`. Hay un
   * test que compara los ocho meses de la semilla byte a byte contra antes.
   */
  const comunReal = ajustado ? 0 : round2(brutoComun - lavado)

  // `as`: los rellena el bucle siguiente, uno por departamento.
  const m3Cobrados = {} as PorDpto<number>
  const montoAgua = {} as PorDpto<number>
  for (const d of DPTOS) {
    const extra = d.id === LAVADO.dpto ? lavado : 0
    const m3 = round2(consumos[d.id] * factor + extra)
    m3Cobrados[d.id] = m3
    montoAgua[d.id] = round2(m3 * precioM3)
  }

  const montoComun = ajustado ? 0 : round2(comunReal * precioM3)

  // ── Los gastos del mes · §4
  //
  // La lista sale de los conceptos que **de verdad existen** —los vigentes que
  // llegan en `entradas.fijos` más los que el administrador esté escribiendo en
  // `ov.fijos`—, ordenados según `ORDEN_GASTOS`, con el agua y la luz insertadas
  // en su sitio.
  //
  // No se inventan líneas para conceptos ausentes: si la tabla de gastos fijos
  // llegara vacía, el mes sale con dos líneas y el problema se ve. Antes salía
  // con diez líneas "por confirmar" que sumaban 0, con un total de S/ 643.40 en
  // vez de S/ 3 317.98, y los dos cuadres en verde.
  const porConcepto = new Map(entradas.fijos.map((g) => [g.concepto, g]))

  /**
   * El monto efectivo de un concepto.
   *
   * `undefined` en el override significa "no lo estoy tocando" y cae al monto
   * guardado; `null` significa "por confirmar" y es una decisión explícita. Son
   * cosas distintas: confundirlas borraba los S/ 680 del ascensor del total sin
   * que nada se pusiera rojo.
   */
  const montoDe = (concepto: string): number | null => {
    const escrito = ov.fijos?.[concepto]
    if (escrito !== undefined) return escrito
    return porConcepto.get(concepto)?.monto ?? null
  }

  // `as`: `ORDEN_GASTOS` es una tupla literal; se ensancha a string para poder
  // buscar en ella un concepto que viene de la base de datos.
  const posicion = (c: string) => {
    const i = (ORDEN_GASTOS as readonly string[]).indexOf(c)
    return i === -1 ? ORDEN_GASTOS.length : i
  }
  const conceptosFijos = [
    ...entradas.fijos.map((g) => g.concepto),
    ...Object.keys(ov.fijos ?? {}),
  ].filter((c) => c !== CONCEPTO_AGUA && c !== CONCEPTO_LUZ)
  const ordenados = [...new Set(conceptosFijos)].sort((a, b) => posicion(a) - posicion(b))

  const lineaFija = (concepto: string): LineaGasto => {
    const fijo = porConcepto.get(concepto)
    const monto = montoDe(concepto)
    return {
      concepto,
      monto,
      ...(fijo?.anual ? { anual: true } : {}),
      // `null` es "por confirmar", no "cuesta cero". La interfaz lo muestra distinto.
      ...(monto == null ? { porConfirmar: true } : {}),
    }
  }

  const posAgua = (ORDEN_GASTOS as readonly string[]).indexOf(CONCEPTO_AGUA)
  const posLuz = (ORDEN_GASTOS as readonly string[]).indexOf(CONCEPTO_LUZ)
  const gastos: LineaGasto[] = []
  let insertadaAgua = false
  let insertadaLuz = false
  for (const concepto of ordenados) {
    if (!insertadaAgua && posicion(concepto) > posAgua) {
      gastos.push({ concepto: CONCEPTO_AGUA, monto: facturaAgua, esAgua: true })
      insertadaAgua = true
    }
    if (!insertadaLuz && posicion(concepto) > posLuz) {
      gastos.push({ concepto: CONCEPTO_LUZ, monto: rec.luz })
      insertadaLuz = true
    }
    gastos.push(lineaFija(concepto))
  }
  if (!insertadaAgua) gastos.push({ concepto: CONCEPTO_AGUA, monto: facturaAgua, esAgua: true })
  if (!insertadaLuz) gastos.push({ concepto: CONCEPTO_LUZ, monto: rec.luz })

  // Gastos extraordinarios del paso 5: se suman al total y **los pagan los siete
  // por su porcentaje**, como todo lo demás. No hay reparto equitativo: si algún
  // vecino pagó algo aparte, eso se maneja con un crédito a su cuota.
  for (const e of ov.extras ?? entradas.extras) {
    if (e.tipo === 'gasto') gastos.push({ concepto: e.concepto, monto: e.monto, extra: true })
  }

  const totalMes = sumarMontos(gastos)
  // El agua se saca de la base porque no se reparte por flat sino por consumo.
  const baseMant = round2(totalMes - facturaAgua)

  // ── Créditos · §4.2 · salen del saldo de la cuenta, no de los demás vecinos
  const creditos: Partial<Record<DptoId, number>> = {}
  for (const e of ov.extras ?? entradas.extras) {
    if (e.tipo === 'credito' && e.dpto) {
      creditos[e.dpto] = (creditos[e.dpto] ?? 0) + e.monto
    }
  }

  // `as`: lo rellena el bucle de abajo, uno por departamento.
  const cuotas = {} as PorDpto<CuotaDpto>
  for (const d of DPTOS) {
    // OJO: `Math.round(baseMant * flat) / 100` **no** es siempre igual a
    // `round2(baseMant * flat / 100)`. Difieren en un céntimo cuando el producto
    // cae justo en el medio: con baseMant 2925.00 y flat 20.22 dan 591.44 y
    // 591.43. Por eso se conserva la forma escrita del original y no se
    // "simplifica" a `round2`: `01` §9 dice que no se mueve ningún redondeo de
    // sitio, y aquí eso mueve dinero de verdad.
    const mant = Math.round(baseMant * d.flat) / 100
    /**
     * El crédito, a céntimos como todo lo que es plata.
     *
     * Era el único campo de dinero del resultado que salía sin redondear: un
     * crédito de S/ 12.345 se guardaba así, y el vecino veía un decimal de más
     * en la tarjeta del mes. Lo encontró la batería con un crédito
     * infinitesimal, que es el mismo defecto en su forma extrema.
     *
     * Comprobado que no mueve nada: los 224 tests del motor, incluidos los ocho
     * meses de fidelidad al mockup y las seis variantes, dan idéntico con y sin
     * este `round2`.
     */
    const cred = round2(creditos[d.id] ?? 0)
    cuotas[d.id] = {
      credito: cred,
      mantenimiento: round2(mant),
      agua: montoAgua[d.id],
      m3: m3Cobrados[d.id],
      m3medidos: consumos[d.id],
      lavado: d.id === LAVADO.dpto ? lavado : 0,
      total: round2(mant + montoAgua[d.id] - cred),
      lecturaAnterior: lecAnt[d.id],
      lecturaActual: lecAct[d.id],
    }
  }

  // ── Los dos cuadres · §5
  const sumaAgua = round2(DPTOS.reduce((s, d) => s + montoAgua[d.id], 0))
  /**
   * Los dos cuadres se miden contra la cota que el redondeo impone, no contra
   * una constante. Ver `toleranciaAgua` en `constantes.ts`: el error crece con
   * el precio del m³, así que una tolerancia fija en soles falla por
   * construcción en cuanto el agua se encarece.
   */
  const cuadraAgua = Math.abs(sumaAgua + montoComun - facturaAgua) <= toleranciaAgua(precioM3)

  /**
   * El tercer cuadre del agua, **en metros cúbicos y sin precio de por medio**.
   *
   * Es el que impide que ensanchar la tolerancia en soles ciegue algo. Lo que
   * se le cobra a los siete más el área común tiene que ser lo que facturó
   * SEDAPAL, y eso vale igual a S/ 2.50 el m³ que a S/ 30.
   */
  const sumaM3Cobrados = round2(DPTOS.reduce((s, d) => s + m3Cobrados[d.id], 0))
  const cuadraM3 = Math.abs(sumaM3Cobrados + comunReal - rec.aguaM3) <= TOLERANCIA_M3

  const totalCreditos = round2(DPTOS.reduce((s, d) => s + (cuotas[d.id].credito || 0), 0))
  const sumaCuotas = round2(DPTOS.reduce((s, d) => s + cuotas[d.id].total, 0))
  const cuadraMes =
    Math.abs(sumaCuotas + montoComun + totalCreditos - totalMes) <= toleranciaMes(precioM3)

  // El tercer cuadre. Los dos de `01` §5 son identidades algebraicas: se
  // cumplen igual con cifras imposibles. Ver `sanidad.ts`.
  const sanidad = revisarResultado({
    consumos, cuotas, precioM3, facturaAgua, comunReal, montoComun, factor, totalMes, gastos, rec,
  })

  return {
    mesId,
    valido: true,
    motivoInvalido: null,
    dptosSinLectura: [],
    rec,
    consumos,
    sumaMedida,
    facturaAgua,
    precioM3,
    brutoComun,
    comunReal,
    lavado,
    ajustado,
    factor,
    montoComun,
    gastos,
    totalMes,
    baseMant,
    cuotas,
    sumaAgua,
    sumaCuotas,
    totalCreditos,
    cuadraAgua,
    cuadraM3,
    sumaM3Cobrados,
    cuadraMes,
    cuadraSanidad: sanidad.cuadra,
    motivosSanidad: sanidad.motivos,
    cuadra: cuadraAgua && cuadraM3 && cuadraMes && sanidad.cuadra,
    descuento: rec.descuento ?? 0,
  }
}

export { RECIBO_VACIO }
