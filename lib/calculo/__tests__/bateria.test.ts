/**
 * La batería. **El motor calcula todo, y tiene que aguantar cualquier cosa.**
 *
 * Los otros archivos de test comprueban que el motor da bien los casos que
 * conocemos: los catorce de `01` §10, los ocho meses de la semilla al céntimo,
 * y un puñado de bordes escritos a mano. Este comprueba otra cosa, que es la
 * que rompe en producción: **que no dé mal ninguno de los que no conocemos.**
 *
 * La diferencia práctica está en cómo se generan las entradas. Aquí no son
 * plausibles: son hostiles a propósito. Medidores que retroceden, medidores que
 * se reinician, un descuento mayor que la factura, un recibo de un céntimo, un
 * consumo de cuatro cifras, montos con seis decimales, un crédito de cien mil
 * soles, los ocho gastos en `null`, lecturas a medias. Cosas que el vecino no
 * va a hacer nunca y que quien administra va a hacer alguna vez, tecleando a
 * las once de la noche.
 *
 * Sobre todo ello se afirman **invariantes**: verdades que tienen que valer en
 * cada una de las corridas, salga el mes válido o inválido. Un invariante que
 * falla una vez entre diez mil es un bug que aparece un martes de marzo y nadie
 * sabe reproducir.
 */

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { calcularMes } from '../calcularMes'
import { DPTOS, DPTO_IDS, TOLERANCIA_M3, toleranciaMes } from '../constantes'
import { round2 } from '../redondeo'
import { revisarResultado } from '../sanidad'
import type { EntradasMes, Extra, GastoFijo, Lecturas, MesId, Overrides, ResultadoMes } from '../tipos'
import { FIJOS } from '../../semilla'

const CORRIDAS = 20000

// ── Generadores ────────────────────────────────────────────────────────────

/** Un monto de dinero cualquiera, incluidos los feos. */
const monto = fc.oneof(
  { weight: 6, arbitrary: fc.double({ min: 0, max: 5000, noNaN: true }) },
  // Céntimos sueltos y montos con más decimales de los que caben en un sol.
  { weight: 2, arbitrary: fc.double({ min: 0, max: 3, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 0.01, 0.005, 1e-9, 99999.99) },
)

/** Una lectura de medidor. Puede faltar, y puede ser menor que la anterior. */
const lectura = fc.double({ min: 0, max: 3000, noNaN: true })

const lecturasArb = (): fc.Arbitrary<Lecturas> =>
  fc.dictionary(fc.constantFrom(...DPTO_IDS), lectura, { minKeys: 0, maxKeys: 7 }) as fc.Arbitrary<Lecturas>

const fijosArb = (): fc.Arbitrary<GastoFijo[]> =>
  fc.array(fc.option(monto, { nil: null }), { minLength: FIJOS.length, maxLength: FIJOS.length }).map((ms) =>
    FIJOS.map((f, i) => ({ ...f, monto: ms[i] ?? null })),
  )

const extrasArb = (): fc.Arbitrary<Extra[]> =>
  fc.array(
    fc.oneof(
      fc.record({
        tipo: fc.constant('gasto' as const),
        concepto: fc.constantFrom('Pintura', 'Bomba', 'Cerrajero'),
        monto,
        dpto: fc.constant(undefined),
      }),
      fc.record({
        tipo: fc.constant('credito' as const),
        concepto: fc.constantFrom('Devolución', 'Ajuste'),
        monto,
        dpto: fc.constantFrom(...DPTO_IDS),
      }),
    ) as fc.Arbitrary<Extra>,
    { maxLength: 4 },
  )

const entradasArb = (): fc.Arbitrary<EntradasMes> =>
  fc.record({
    mesId: fc.constantFrom('2026-05', '2026-06', '2026-07', '2027-01') as fc.Arbitrary<MesId>,
    recibo: fc.option(
      fc.record({
        aguaM3: fc.double({ min: 0, max: 400, noNaN: true }),
        aguaMonto: monto,
        luz: monto,
        descuento: fc.option(monto, { nil: null }),
      }),
      { nil: null },
    ),
    lecturas: lecturasArb(),
    lecturasAnteriores: lecturasArb(),
    fijos: fijosArb(),
    extras: extrasArb(),
    lavadoM3: fc.double({ min: 0, max: 40, noNaN: true }),
  })

const overridesArb = (): fc.Arbitrary<Overrides> =>
  fc.record(
    {
      recibo: fc.option(fc.record({ aguaM3: fc.double({ min: 0, max: 400, noNaN: true }) }), { nil: undefined }),
      lecturas: fc.option(lecturasArb(), { nil: undefined }),
      lavadoM3: fc.option(fc.double({ min: 0, max: 40, noNaN: true }), { nil: undefined }),
    },
    { requiredKeys: [] },
  ) as fc.Arbitrary<Overrides>

// ── Invariantes ────────────────────────────────────────────────────────────

/** Recorre cada número del resultado. Si aparece uno imposible, lo nombra. */
function cifrasImposibles(r: ResultadoMes): string[] {
  const malas: string[] = []
  const mirar = (nombre: string, v: unknown) => {
    if (typeof v !== 'number') return
    if (Number.isNaN(v)) malas.push(`${nombre} es NaN`)
    else if (!Number.isFinite(v)) malas.push(`${nombre} es ${v > 0 ? 'Infinity' : '-Infinity'}`)
  }
  const recorrer = (nombre: string, v: unknown) => {
    if (v === null || v === undefined) return
    if (typeof v === 'number') return mirar(nombre, v)
    if (Array.isArray(v)) return v.forEach((x, i) => recorrer(`${nombre}[${i}]`, x))
    if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v as object)) recorrer(`${nombre}.${k}`, x)
    }
  }
  recorrer('resultado', r)
  return malas
}

/**
 * Lo que tiene que ser cierto, y **cuándo**.
 *
 * La distinción es la que costó tres vueltas encontrar, y es la que hace útil a
 * todo este archivo. Hay dos niveles:
 *
 *  - **Siempre.** Salga el mes válido, inválido o bloqueado: ni un `NaN`, ni un
 *    `Infinity`, los siete departamentos presentes, y un motivo escrito cuando
 *    es inválido. Estas no admiten excepción.
 *
 *  - **Solo si la app lo dejaría publicar** (`r.cuadra`). Que un mes se calcule
 *    con una cifra imposible dentro no es un fallo del motor: para eso está el
 *    tercer cuadre, que lo marca y bloquea el paso 6 del cierre. El fallo sería
 *    que se pudiera **publicar** así.
 *
 * Las tres primeras versiones de esto exigían el segundo nivel siempre, y daban
 * en rojo meses que el motor estaba tratando exactamente bien: un medidor que
 * retrocede, un descuento mayor que el recibo. El motor los marcaba y los
 * bloqueaba; el invariante era el que estaba mal escrito.
 */
function invariantes(r: ResultadoMes): string[] {
  const fallos: string[] = [...cifrasImposibles(r)]

  // ── Siempre ──────────────────────────────────────────────────────────────

  for (const d of DPTOS) {
    if (!r.cuotas[d.id]) fallos.push(`falta la cuota del ${d.id}`)
    if (r.consumos[d.id] === undefined) fallos.push(`falta el consumo del ${d.id}`)
  }

  if (!r.valido) {
    // Un mes inválido dice por qué, y nunca se puede publicar.
    if (!r.motivoInvalido) fallos.push('inválido sin motivo')
    if (r.cuadra) fallos.push('inválido y aun así publicable')
    return fallos
  }

  // Un mes con una cifra imposible dentro se calcula, pero no se publica.
  const revision = revisarResultado(r)
  if (!revision.cuadra && r.cuadra) {
    fallos.push(`la sanidad falla y el mes se publicaría igual: ${revision.motivos.join(' / ')}`)
  }

  // El total es exactamente la suma de sus líneas. Ninguna se pierde por el
  // camino, publicable o no: si una línea se evapora, el gasto no lo paga nadie.
  const suma = round2(r.gastos.reduce((s, g) => s + (g.monto ?? 0), 0))
  if (Math.abs(suma - r.totalMes) > 0.005) {
    fallos.push(`totalMes ${r.totalMes} no es la suma de sus líneas ${suma}`)
  }

  // ── Solo si la app lo dejaría publicar ───────────────────────────────────

  if (!r.cuadra) return fallos

  // 1 · Nadie paga menos que cero. Ni agua, ni mantenimiento, ni m³.
  for (const d of DPTOS) {
    const q = r.cuotas[d.id]
    if (q.agua < 0) fallos.push(`${d.id}: agua negativa (${q.agua})`)
    if (q.mantenimiento < 0) fallos.push(`${d.id}: mantenimiento negativo (${q.mantenimiento})`)
    if (q.m3 < 0) fallos.push(`${d.id}: m³ negativos (${q.m3})`)
    if (q.total < 0) fallos.push(`${d.id}: cuota total negativa (${q.total})`)
  }

  /**
   * 2 · **El cuadre del mes**, tal como lo escribe `01` §5.2:
   *
   *     Σ cuota(d) + montoComun + Σ créditos ≈ totalMes
   *
   * El área común y los créditos entran porque **los pone el edificio, no los
   * vecinos** (`01` §3.2). La primera versión los dejaba fuera y daba en rojo
   * un mes correcto: el error era mío. Se arregla leyendo la regla, no
   * ensanchando la tolerancia.
   */
  const sumaCuotas = round2(DPTOS.reduce((s, d) => s + r.cuotas[d.id].total, 0))
  const desvio = Math.abs(sumaCuotas + r.montoComun + r.totalCreditos - r.totalMes)
  if (desvio > toleranciaMes(r.precioM3)) {
    fallos.push(
      `el mes no cuadra por S/ ${desvio.toFixed(4)}: cuotas ${sumaCuotas} + común ${r.montoComun} ` +
        `+ créditos ${r.totalCreditos} contra total ${r.totalMes}`,
    )
  }

  // 3 · El cuadre del agua **en m³**, que no depende del precio.
  const sumaM3 = round2(DPTOS.reduce((s, d) => s + r.cuotas[d.id].m3, 0))
  if (Math.abs(sumaM3 + r.comunReal - r.rec.aguaM3) > TOLERANCIA_M3) {
    fallos.push(`los m³ no cuadran: ${sumaM3} + común ${r.comunReal} contra ${r.rec.aguaM3}`)
  }

  // 4 · Nunca se cobra más agua de la que facturó SEDAPAL.
  if (r.factor > 1 + 1e-9) fallos.push(`factor de ajuste ${r.factor} > 1`)

  // 5 · El área común nunca es negativa: o sobra agua, o no sobra.
  if (r.comunReal < 0) fallos.push(`área común negativa: ${r.comunReal}`)

  /**
   * ── Reparto ──────────────────────────────────────────────────────────────
   *
   * **Los invariantes de arriba son leyes de conservación, y una ley de
   * conservación no ve una redistribución.** Se comprobó metiendo dos defectos
   * a mano: repartir el mantenimiento por partes iguales en vez de por flat, y
   * restarle el crédito de uno a los siete. Los dos dejaban el total intacto y
   * los cinco invariantes anteriores en verde. El dinero llegaba entero al
   * edificio y a los bolsillos equivocados.
   *
   * La suite entera sí los atrapaba, pero solo porque los tests de fidelidad
   * fijan al céntimo las cuotas de los ocho meses de la semilla. Eso depende de
   * la forma de esos ocho meses, no de una regla. Estos tres sí son la regla.
   */

  // 6 · El mantenimiento se reparte por flat, y por nada más. `01` §4.
  if (r.baseMant > 1) {
    for (const d of DPTOS) {
      const esperado = r.baseMant * (d.flat / 100)
      if (Math.abs(r.cuotas[d.id].mantenimiento - esperado) > 0.02) {
        fallos.push(
          `${d.id}: mantenimiento ${r.cuotas[d.id].mantenimiento} y por su flat de ${d.flat}% ` +
            `le tocarían ${esperado.toFixed(2)}`,
        )
      }
    }
  }

  // 7 · Un crédito llega **solo** a su dueño. `01` §4.2.
  const sumaCreditos = round2(DPTOS.reduce((s, d) => s + (r.cuotas[d.id].credito || 0), 0))
  if (Math.abs(sumaCreditos - r.totalCreditos) > 0.005) {
    fallos.push(`los créditos de las cuotas suman ${sumaCreditos} y totalCreditos dice ${r.totalCreditos}`)
  }
  // Todo lo que es plata está en céntimos. Ni un decimal de más en pantalla.
  for (const d of DPTOS) {
    const q = r.cuotas[d.id]
    for (const [campo, valor] of [['credito', q.credito], ['mantenimiento', q.mantenimiento], ['agua', q.agua], ['total', q.total]] as const) {
      if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) {
        fallos.push(`${d.id}: ${campo} no está en céntimos (${valor})`)
      }
    }
  }

  // 8 · El agua se cobra al mismo precio para todos: quien consume el doble
  //     paga el doble. Nadie tiene una tarifa propia.
  for (const d of DPTOS) {
    const q = r.cuotas[d.id]
    const esperado = q.m3 * r.precioM3
    if (Math.abs(q.agua - esperado) > 0.02) {
      fallos.push(`${d.id}: paga ${q.agua} de agua y por sus ${q.m3} m³ le tocarían ${esperado.toFixed(2)}`)
    }
  }

  return fallos
}

/**
 * Lo que hay que comprobar **contra la entrada**, no contra el resultado.
 *
 * Es el hueco que dejaban los invariantes anteriores, y costó verlo: al restar
 * el crédito de uno a los siete, `totalCreditos` cuadraba igual, porque se
 * deriva de las propias cuotas. La identidad se cumplía sobre cifras ya
 * corrompidas. Un resultado solo puede contradecirse a sí mismo; para ver que
 * el dinero llegó a quien tenía que llegar hay que volver a lo que se pidió.
 */
function contraLaEntrada(entradas: EntradasMes, ov: Overrides, r: ResultadoMes): string[] {
  const fallos: string[] = []
  if (!r.valido) return fallos

  const pedidos = {} as Record<string, number>
  for (const e of ov.extras ?? entradas.extras) {
    if (e.tipo === 'credito' && e.dpto) pedidos[e.dpto] = (pedidos[e.dpto] ?? 0) + e.monto
  }
  for (const d of DPTOS) {
    const esperado = round2(pedidos[d.id] ?? 0)
    const recibido = round2(r.cuotas[d.id].credito || 0)
    if (Math.abs(recibido - esperado) > 0.005) {
      fallos.push(`${d.id}: se le acredita ${recibido} y en el mes se pidió ${esperado}`)
    }
  }
  return fallos
}

describe('batería · el motor aguanta cualquier entrada', () => {
  it(`${CORRIDAS} combinaciones hostiles y ni una cifra imposible`, () => {
    fc.assert(
      fc.property(entradasArb(), overridesArb(), (entradas, ov) => {
        const r = calcularMes(entradas, ov)
        const fallos = [...invariantes(r), ...contraLaEntrada(entradas, ov, r)]
        if (fallos.length > 0) throw new Error(fallos.join('\n  '))
        return true
      }),
      { numRuns: CORRIDAS },
    )
  })

  it('nunca lanza una excepción, pase lo que pase', () => {
    fc.assert(
      fc.property(entradasArb(), overridesArb(), (entradas, ov) => {
        // Un motor que revienta deja la pantalla del cierre en blanco con las
        // siete lecturas ya tecleadas dentro. Devuelve inválido o devuelve
        // cifras, pero no tira.
        expect(() => calcularMes(entradas, ov)).not.toThrow()
        return true
      }),
      { numRuns: CORRIDAS },
    )
  })

  it('es determinista: la misma entrada da el mismo resultado, byte a byte', () => {
    fc.assert(
      fc.property(entradasArb(), overridesArb(), (entradas, ov) => {
        const a = calcularMes(entradas, ov)
        const b = calcularMes(entradas, ov)
        expect(JSON.stringify(b)).toBe(JSON.stringify(a))
        return true
      }),
      { numRuns: 200 },
    )
  })

  it('no muta lo que le pasan', () => {
    fc.assert(
      fc.property(entradasArb(), overridesArb(), (entradas, ov) => {
        const antesE = JSON.stringify(entradas)
        const antesO = JSON.stringify(ov)
        calcularMes(entradas, ov)
        expect(JSON.stringify(entradas)).toBe(antesE)
        expect(JSON.stringify(ov)).toBe(antesO)
        return true
      }),
      { numRuns: 200 },
    )
  })
})

// ── Correcciones ───────────────────────────────────────────────────────────

/**
 * **Corregir un mes ya publicado es el camino más caro de equivocarse.**
 *
 * No es teórico: un mes publicado ya se le avisó a los siete, alguno ya pagó
 * contra la cifra vieja, y la corrección tiene que dejar el mes tan coherente
 * como estaba, no «casi». Los tests que había cubrían la detección del dígito
 * transpuesto de `04`, que es una pieza; esto cubre la otra, que es qué pasa
 * con el mes entero **después** de aplicar cualquier corrección.
 *
 * La forma de una corrección es siempre la misma: se recalcula el mes con la
 * entrada cambiada. Así que se genera un mes bueno, se le cambia una cosa, y se
 * exige que el resultado siga cumpliendo todos los invariantes y que **la
 * diferencia esté explicada**.
 */

/** Un mes que sale bien, para partir de algo publicable. */
function mesBueno(semilla: number): { entradas: EntradasMes; r: ResultadoMes } {
  let s = semilla
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const anteriores: Lecturas = {}
  const actuales: Lecturas = {}
  const aguaM3 = round2(60 + rnd() * 60)
  // Los medidores miden algo menos que lo facturado, que es el caso corriente.
  const objetivo = aguaM3 * (0.9 + rnd() * 0.08)
  const pesos = DPTOS.map(() => rnd() + 0.2)
  const total = pesos.reduce((a, b) => a + b, 0)
  DPTOS.forEach((d, i) => {
    const base = round2(500 + rnd() * 800)
    anteriores[d.id] = base
    actuales[d.id] = round2(base + (objetivo * pesos[i]!) / total)
  })
  const entradas: EntradasMes = {
    mesId: '2026-06',
    recibo: { aguaM3, aguaMonto: round2(aguaM3 * (2 + rnd() * 10)), luz: round2(100 + rnd() * 200), descuento: null },
    lecturas: actuales,
    lecturasAnteriores: anteriores,
    fijos: FIJOS,
    extras: [],
    lavadoM3: 1.5,
  }
  return { entradas, r: calcularMes(entradas, {}) }
}

/** Las correcciones que quien administra puede hacer de verdad. */
const CORRECCIONES: { como: string; aplicar: (e: EntradasMes, rnd: () => number) => Overrides }[] = [
  { como: 'una lectura mal tecleada', aplicar: (e, rnd) => ({ lecturas: { '401': round2((e.lecturas['401'] ?? 0) + rnd() * 8) } }) },
  { como: 'dos lecturas a la vez', aplicar: (e, rnd) => ({ lecturas: { '101': round2((e.lecturas['101'] ?? 0) + rnd() * 5), '502': round2((e.lecturas['502'] ?? 0) + rnd() * 5) } }) },
  { como: 'los m³ del recibo', aplicar: (e, rnd) => ({ recibo: { aguaM3: round2((e.recibo?.aguaM3 ?? 80) * (1 + rnd() * 0.2)) } }) },
  { como: 'el monto del recibo', aplicar: (e, rnd) => ({ recibo: { aguaMonto: round2((e.recibo?.aguaMonto ?? 400) * (1 + rnd() * 0.3)) } }) },
  { como: 'un descuento que faltaba', aplicar: (e) => ({ recibo: { descuento: round2((e.recibo?.aguaMonto ?? 400) * 0.1) } }) },
  { como: 'el recibo de luz', aplicar: (_, rnd) => ({ fijos: { 'Recibo de luz común': round2(80 + rnd() * 300) } }) },
  { como: 'un gasto fijo que estaba mal', aplicar: (_, rnd) => ({ fijos: { Ascensor: round2(300 + rnd() * 900) } }) },
  { como: 'un gasto fijo que pasa a por confirmar', aplicar: () => ({ fijos: { Ascensor: null } }) },
  { como: 'un gasto extraordinario que faltaba', aplicar: (_, rnd) => ({ extras: [{ tipo: 'gasto', concepto: 'Portón', monto: round2(100 + rnd() * 900) }] }) },
  { como: 'un crédito que faltaba', aplicar: (_, rnd) => ({ extras: [{ tipo: 'credito', dpto: '301', monto: round2(5 + rnd() * 40) }] }) },
  { como: 'el lavado, que se apaga', aplicar: () => ({ lavadoM3: 0 }) },
  { como: 'el lavado, que cambia de m³', aplicar: () => ({ lavadoM3: 3 }) },
]

describe('batería · corregir un mes publicado', () => {
  for (const { como, aplicar } of CORRECCIONES) {
    it(`${como}: el mes sigue cuadrando y la diferencia está explicada`, () => {
      let corregidos = 0
      for (let semilla = 1; semilla <= 300; semilla++) {
        const { entradas, r: antes } = mesBueno(semilla)
        if (!antes.valido || !antes.cuadra) continue
        let s = semilla * 7919
        const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
        // La corrección se calcula **una vez**: generarla dos veces con un
        // generador aleatorio daba dos correcciones distintas, y el chequeo
        // comparaba el resultado de una contra la entrada de la otra. La
        // primera versión de esto daba en rojo un motor perfectamente sano.
        const correccion = aplicar(entradas, rnd)
        const despues = calcularMes(entradas, correccion)

        const fallos = [...invariantes(despues), ...contraLaEntrada(entradas, correccion, despues)]
        expect(fallos.join('\n  '), `${como} · semilla ${semilla}`).toBe('')
        if (!despues.valido || !despues.cuadra) continue
        corregidos++

        /**
         * **La diferencia tiene que estar explicada, entera.**
         *
         * Lo que cambia en lo que pagan los siete, más lo que cambia el área
         * común y los créditos, tiene que ser exactamente lo que cambia el
         * total del mes. Si no, la corrección movió plata que no está en
         * ninguna línea: eso es lo que hay que enseñarle al vecino en el aviso
         * de corrección, y si no cuadra, el aviso miente.
         */
        const deltaCuotas = round2(
          DPTOS.reduce((s2, d) => s2 + despues.cuotas[d.id].total - antes.cuotas[d.id].total, 0),
        )
        const deltaComun = round2(despues.montoComun - antes.montoComun)
        const deltaCreditos = round2(despues.totalCreditos - antes.totalCreditos)
        const deltaTotal = round2(despues.totalMes - antes.totalMes)
        const desvio = Math.abs(deltaCuotas + deltaComun + deltaCreditos - deltaTotal)
        expect(desvio, `${como} · semilla ${semilla}: la corrección mueve S/ ${desvio.toFixed(4)} sin línea que lo explique`)
          .toBeLessThanOrEqual(toleranciaMes(despues.precioM3) * 2)
      }
      // Si el generador no produjo ni un mes corregible, este test no probó nada.
      expect(corregidos, 'no se corrigió ni un mes: el generador no sirve').toBeGreaterThan(50)
    })
  }

  it('corregir dos veces seguidas da lo mismo que corregir una con el valor final', () => {
    for (let semilla = 1; semilla <= 200; semilla++) {
      const { entradas, r } = mesBueno(semilla)
      if (!r.valido || !r.cuadra) continue
      const unaVez = calcularMes(entradas, { lecturas: { '401': 999 }, fijos: { Ascensor: 700 } })
      // Dos correcciones encadenadas: la segunda parte del resultado de la
      // primera, que es como funciona el flujo de verdad.
      const primera = { ...entradas, lecturas: { ...entradas.lecturas, '401': 999 } }
      const dosVeces = calcularMes(primera, { fijos: { Ascensor: 700 } })
      expect(JSON.stringify(dosVeces.cuotas)).toBe(JSON.stringify(unaVez.cuotas))
    }
  })

  it('deshacer una corrección devuelve el mes exactamente a como estaba', () => {
    for (let semilla = 1; semilla <= 200; semilla++) {
      const { entradas, r: antes } = mesBueno(semilla)
      if (!antes.valido || !antes.cuadra) continue
      const original = entradas.lecturas['401']!
      const corregido = calcularMes(entradas, { lecturas: { '401': round2(original + 12.34) } })
      expect(corregido.cuotas['401'].total).not.toBe(antes.cuotas['401'].total)
      const deshecho = calcularMes(entradas, { lecturas: { '401': original } })
      expect(JSON.stringify(deshecho)).toBe(JSON.stringify(antes))
    }
  })
})
