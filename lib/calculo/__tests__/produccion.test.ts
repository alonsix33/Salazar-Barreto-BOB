/**
 * Los caminos que **producción** recorre y el prototipo no.
 *
 * Este archivo existe por un hallazgo concreto de la auditoría adversaria: la
 * suite original daba 140/140 en verde con dos motores que se comportaban
 * distinto en dinero. Cubría las rutas del mockup —donde todo llega por
 * `overrides`— y dejaba sin tocar las de la base de datos.
 *
 * Cada bloque de aquí abajo se escribió después de comprobar que, sin él, se
 * podía romper el motor sin que ningún test se pusiera rojo.
 */

import { describe, expect, it } from 'vitest'
import { calcularMes } from '../calcularMes'
import { serieSaldo, type MesConPagos } from '../saldo'
import { proponerCorreccion } from '../correccion'
import { DPTOS, GASTOS_FIJOS, LAVADO } from '../constantes'
import { revisarResultado, sumarMontos } from '../sanidad'
import { fmt, round2 } from '../redondeo'
import type { DptoId, EntradasMes, Extra, GastoFijo, Lecturas, MesId } from '../tipos'
import { calcularMesSemilla, entradasDe } from './ayuda'

const JUNIO = calcularMesSemilla('2026-06')

// ── Los extras guardados · la vía que usa publicar ────────────────────────────

describe('extras guardados en la base, no en el borrador', () => {
  it('un gasto extraordinario guardado sube el total y lo pagan los siete', () => {
    const c = calcularMes({
      ...entradasDe('2026-06'),
      extras: [{ tipo: 'gasto', concepto: 'Portón', monto: 700 }],
    })
    expect(c.totalMes).toBe(JUNIO.totalMes + 700)
    expect(c.cuotas['101'].total).toBeGreaterThan(JUNIO.cuotas['101'].total)
    expect(c.cuadra).toBe(true)
  })

  it('un crédito guardado se le resta a su dueño y a nadie más', () => {
    const c = calcularMes({
      ...entradasDe('2026-06'),
      extras: [{ tipo: 'credito', dpto: '301', monto: 50 }],
    })
    expect(c.totalMes).toBe(JUNIO.totalMes)
    expect(c.cuotas['301'].total).toBe(JUNIO.cuotas['301'].total - 50)
    expect(c.cuotas['101'].total).toBe(JUNIO.cuotas['101'].total)
    expect(c.totalCreditos).toBe(50)
    expect(c.cuadra).toBe(true)
  })

  it('el borrador reemplaza la lista guardada entera, no la añade', () => {
    // Es la semántica documentada de un override de lista. Se fija aquí porque
    // si la interfaz manda `[loNuevo]` en vez de `[...loGuardado, loNuevo]`,
    // los extras guardados desaparecen del cálculo sin que nada avise.
    const guardados: Extra[] = [
      { tipo: 'gasto', concepto: 'Portón', monto: 700 },
      { tipo: 'credito', dpto: '301', monto: 50 },
    ]
    const entradas = { ...entradasDe('2026-06'), extras: guardados }
    expect(calcularMes(entradas).totalMes).toBe(JUNIO.totalMes + 700)
    const conOverride = calcularMes(entradas, { extras: [{ tipo: 'gasto', concepto: 'Otro', monto: 100 }] })
    expect(conOverride.totalMes).toBe(JUNIO.totalMes + 100)
    expect(conOverride.totalCreditos).toBe(0)
  })
})

// ── Lo que el administrador teclea · overrides ────────────────────────────────

describe('ov.lecturas · lo que se teclea en el paso 1 del cierre', () => {
  it('pisa la lectura guardada y cambia el consumo', () => {
    const c = calcularMes(entradasDe('2026-06'), { lecturas: { '401': 425.0 } })
    expect(c.cuotas['401'].lecturaActual).toBe(425.0)
    expect(c.consumos['401']).not.toBe(JUNIO.consumos['401'])
    expect(c.consumos['401']).toBe(round2(425.0 - JUNIO.cuotas['401'].lecturaAnterior))
  })

  it('completa un mes al que le falta una lectura guardada', () => {
    const entradas = entradasDe('2026-07')
    const sin502: EntradasMes = {
      ...entradas,
      lecturas: Object.fromEntries(
        Object.entries(entradas.lecturas).filter(([k]) => k !== '502'),
      ) as Lecturas,
    }
    expect(calcularMes(sin502).valido).toBe(false)
    expect(calcularMes(sin502, { lecturas: { '502': 292.678 } }).valido).toBe(true)
  })
})

describe('ov.recibo · lo que se teclea en los pasos 2 y 3', () => {
  it('el descuento del borrador pisa el guardado', () => {
    const c = calcularMes(entradasDe('2026-05'), { recibo: { descuento: 20 } })
    expect(c.descuento).toBe(20)
    expect(c.facturaAgua).toBe(325 - 20)
  })

  it('un descuento en null lo borra, y no hereda el guardado', () => {
    // `01` §11: cada campo pisa la semilla individualmente. Con `??` encadenado
    // un `null` se comportaba como "no lo estoy tocando" y mayo heredaba sus
    // S/ 17.33 de descuento: dinero que el edificio dejaba de cobrar con los
    // dos cuadres en verde.
    const conDescuento = calcularMesSemilla('2026-05')
    expect(conDescuento.descuento).toBe(17.33)
    const sinDescuento = calcularMes(entradasDe('2026-05'), { recibo: { descuento: null } })
    expect(sinDescuento.descuento).toBe(0)
    expect(sinDescuento.facturaAgua).toBe(325)
  })

  it('un descuento en 0 también lo borra', () => {
    expect(calcularMes(entradasDe('2026-05'), { recibo: { descuento: 0 } }).facturaAgua).toBe(325)
  })
})

describe('ov.fijos · lo que se teclea en el paso 4', () => {
  it('un monto escrito pisa el guardado', () => {
    const c = calcularMes(entradasDe('2026-06'), { fijos: { Ascensor: 700 } })
    expect(c.totalMes).toBe(JUNIO.totalMes + 20)
  })

  it('undefined significa "no lo estoy tocando" y deja el guardado', () => {
    // Con `hasOwnProperty` un `undefined` se convertía en "por confirmar" y
    // borraba los S/ 680 del ascensor del total, cuadrando igual.
    const c = calcularMes(entradasDe('2026-06'), { fijos: { Ascensor: undefined as unknown as number } })
    expect(c.totalMes).toBe(JUNIO.totalMes)
    expect(c.gastos.find((g) => g.concepto === 'Ascensor')!.monto).toBe(680)
  })

  it('null significa "por confirmar" y sí lo quita del total', () => {
    const c = calcularMes(entradasDe('2026-06'), { fijos: { Ascensor: null } })
    expect(c.totalMes).toBe(JUNIO.totalMes - 680)
    expect(c.gastos.find((g) => g.concepto === 'Ascensor')!.porConfirmar).toBe(true)
  })

  it('un concepto nuevo escrito en el borrador entra en el mes', () => {
    const c = calcularMes(entradasDe('2026-06'), { fijos: { Jardinería: 90 } })
    expect(c.totalMes).toBe(JUNIO.totalMes + 90)
    expect(c.gastos.map((g) => g.concepto)).toContain('Jardinería')
  })
})

// ── Lo que llega de la base y puede llegar mal ────────────────────────────────

describe('la lista de gastos sale de lo que hay, no de una lista fantasma', () => {
  it('con la tabla de gastos fijos vacía, el mes tiene dos líneas y se ve el problema', () => {
    const c = calcularMes({ ...entradasDe('2026-06'), fijos: [] })
    expect(c.gastos.map((g) => g.concepto)).toEqual([
      'Factura de agua SEDAPAL',
      'Recibo de luz común',
    ])
    // Antes salían diez líneas, ocho de ellas "por confirmar" sumando 0, y el
    // mes cuadraba perfectamente en S/ 643.40 en vez de S/ 3 317.98.
    expect(c.gastos).toHaveLength(2)
  })

  it('los conceptos salen en el orden documentado, con el agua y la luz en su sitio', () => {
    expect(JUNIO.gastos.map((g) => g.concepto)).toEqual([
      'Guardianía · Jorge',
      'Ascensor',
      'Factura de agua SEDAPAL',
      'Recibo de luz común',
      'Mant. bomba',
      'Mant. cisterna',
      'Cerco eléctrico',
      'Cambio extintor',
      'Insumos limpieza',
      'Pozo a tierra',
    ])
  })
})

describe('lavadoM3 que llega nulo desde la base', () => {
  for (const valor of [null, undefined]) {
    it(`${valor} cae al valor configurado, no desactiva el lavado en silencio`, () => {
      const c = calcularMes({ ...entradasDe('2026-06'), lavadoM3: valor as unknown as number })
      expect(c.lavado).toBe(LAVADO.m3)
      expect(c.cuotas['401'].agua).toBe(JUNIO.cuotas['401'].agua)
    })
  }

  it('un 0 explícito sí lo desactiva: es lo que hace la casilla del paso 5', () => {
    expect(calcularMes({ ...entradasDe('2026-06'), lavadoM3: 0 }).lavado).toBe(0)
  })
})

describe('entradas nulas de la base no lanzan una excepción', () => {
  const nulos: [string, Partial<EntradasMes>][] = [
    ['fijos', { fijos: null as unknown as GastoFijo[] }],
    ['extras', { extras: null as unknown as Extra[] }],
    ['lecturas', { lecturas: null as unknown as Lecturas }],
    ['lecturasAnteriores', { lecturasAnteriores: null as unknown as Lecturas }],
  ]
  for (const [campo, parche] of nulos) {
    it(`${campo} en null devuelve un resultado, no un TypeError`, () => {
      expect(() => calcularMes({ ...entradasDe('2026-06'), ...parche })).not.toThrow()
    })
  }

  it('un override nulo tampoco lanza', () => {
    expect(() => calcularMes(entradasDe('2026-06'), null as unknown as undefined)).not.toThrow()
  })
})

// ── El tercer cuadre · cifras imposibles ──────────────────────────────────────

describe('el tercer cuadre · lo que los dos cuadres algebraicos no ven', () => {
  it('un medidor reemplazado da consumo negativo y NO se puede publicar', () => {
    // Sin el tercer cuadre: consumo −174.20 m³, cuota de S/ −375.05, y los dos
    // cuadres en verde porque el área común absorbe el error.
    const entradas = entradasDe('2026-06')
    const c = calcularMes(entradas, { lecturas: { '101': 0.5 } })
    expect(c.consumos['101']).toBeLessThan(0)
    expect(c.cuadraSanidad).toBe(false)
    expect(c.cuadra).toBe(false)
    expect(c.motivosSanidad.join(' ')).toContain('101')
  })

  it('un descuento mayor que el monto se rechaza en la entrada, diciendo por qué', () => {
    /**
     * Antes esto se calculaba entero con una factura de agua negativa y, de
     * ahí, un precio por m³ negativo: el tercer cuadre lo atrapaba al final,
     * pero el motivo que veía quien administra hablaba de precios imposibles en
     * lugar de decirle que mirara el descuento. Ahora se corta antes de
     * calcular nada y el mensaje nombra las dos cifras.
     */
    const c = calcularMes(entradasDe('2026-06'), { recibo: { aguaMonto: 100, descuento: 350 } })
    expect(c.valido).toBe(false)
    expect(c.motivoInvalido).toContain('descuento')
    expect(c.motivoInvalido).toContain('350.00')
    expect(c.motivoInvalido).toContain('100.00')
    expect(c.cuadra).toBe(false)
    // Y ni una cifra imposible dentro: el resultado inválido va en ceros.
    expect(Number.isFinite(c.precioM3)).toBe(true)
  })

  it('un monto que llega como cadena no se traga el gasto en silencio', () => {
    // `s + "1200"` concatenaba y `round2` truncaba: el extra salía en la lista
    // por S/ 1 200.00, desaparecía del total, y el mes cuadraba.
    const c = calcularMes(entradasDe('2026-06'), {
      extras: [{ tipo: 'gasto', concepto: 'Portón', monto: '1200' as unknown as number }],
    })
    expect(c.valido).toBe(false)
    expect(c.cuadra).toBe(false)
  })

  it('un crédito a un departamento que no existe no se evapora', () => {
    const c = calcularMes(entradasDe('2026-06'), {
      extras: [{ tipo: 'credito', dpto: '999' as DptoId, monto: 200 }],
    })
    expect(c.valido).toBe(false)
    expect(c.motivoInvalido).toContain('999')
  })

  it('m³ de SEDAPAL en Infinity no atraviesa el guardián', () => {
    const c = calcularMes(entradasDe('2026-06'), { recibo: { aguaM3: Infinity } })
    expect(c.valido).toBe(false)
    expect(Number.isNaN(c.montoComun)).toBe(false)
  })

  it('ninguna cifra del resultado es NaN ni Infinity con entradas tóxicas', () => {
    const toxicos = [NaN, Infinity, -Infinity, -1, 0]
    for (const v of toxicos) {
      for (const parche of [
        { recibo: { aguaM3: v } },
        { recibo: { aguaMonto: v } },
        { recibo: { luz: v } },
        { recibo: { descuento: v } },
        { lecturas: { '401': v } },
        { lavadoM3: v },
      ]) {
        const c = calcularMes(entradasDe('2026-06'), parche)
        const numeros = [
          c.totalMes, c.baseMant, c.facturaAgua, c.precioM3, c.sumaMedida, c.brutoComun,
          c.comunReal, c.lavado, c.factor, c.montoComun, c.sumaAgua, c.sumaCuotas, c.totalCreditos,
          ...DPTOS.flatMap((d) => Object.values(c.cuotas[d.id])),
        ]
        for (const n of numeros) {
          expect(Number.isFinite(n), `${JSON.stringify(parche)} produjo ${n}`).toBe(true)
        }
      }
    }
  })
})

describe('un mesId mal formado no produce texto basura', () => {
  for (const malo of ['2026-13', 'junio', '', '2026-00', '2026-6']) {
    it(`${JSON.stringify(malo)} devuelve un mes inválido`, () => {
      const c = calcularMes({ ...entradasDe('2026-06'), mesId: malo as MesId })
      expect(c.valido).toBe(false)
      expect(c.motivoInvalido).toContain('AAAA-MM')
    })
  }
})

// ── La forma escrita de los redondeos ─────────────────────────────────────────

describe('el redondeo del mantenimiento conserva la forma del original', () => {
  it('round(baseMant × flat) / 100 no es lo mismo que round2(baseMant × flat / 100)', () => {
    // El motor promete que no se mueve ningún redondeo de sitio. Este caso fija
    // que las dos formas **no** son intercambiables: difieren en un céntimo.
    // El caso va atado a un flat **vigente** (502 = 20.23, el de la escritura).
    // Antes usaba 20.22 y, al corregir el flat a la escritura, este par dejaba
    // de diferir: el test habría seguido en verde sin probar ya nada.
    const baseMant = 2850.0
    const flat = 20.23
    const formaOriginal = Math.round(baseMant * flat) / 100
    const formaIngenua = Math.round((baseMant * flat) / 100 * 100) / 100
    expect(formaOriginal).toBe(576.56)
    expect(formaIngenua).toBe(576.55)
    expect(formaOriginal).not.toBe(formaIngenua)
  })

  it('el motor usa la forma del original', () => {
    // Se construye un mes cuyo baseMant es exactamente 2850.00 y se comprueba
    // que la cuota del 502 (flat 20.23) sale con la forma original. Con la
    // forma ingenua saldría 576.55: un céntimo de diferencia que este test ve.
    const entradas = entradasDe('2026-06')
    const c = calcularMes(entradas, {
      fijos: Object.fromEntries(GASTOS_FIJOS.map((g) => [g.concepto, null])),
      // totalMes = agua (325) + luz (2850) ⇒ baseMant = totalMes − agua = 2850
      recibo: { aguaM3: 78, aguaMonto: 325, luz: 2850 },
    })
    expect(c.baseMant).toBe(2850.0)
    expect(c.cuotas['502'].mantenimiento).toBe(576.56)
  })
})

// ── El saldo ──────────────────────────────────────────────────────────────────

describe('la serie del saldo no se envenena', () => {
  it('un mes inválido en medio no arrastra NaN a los meses sanos', () => {
    const meses: MesConPagos[] = [
      { mesId: '2026-05', resultado: calcularMesSemilla('2026-05'), pagos: {} },
      { mesId: '2026-06', resultado: calcularMes(entradasDe('2026-06'), { recibo: { aguaM3: 0 } }), pagos: {} },
      { mesId: '2026-07', resultado: calcularMesSemilla('2026-07'), pagos: {} },
    ]
    const serie = serieSaldo(meses, 5000)
    for (const fila of serie) {
      expect(Number.isFinite(fila.saldo), `${fila.mes} salió ${fila.saldo}`).toBe(true)
      expect(fmt(fila.saldo)).not.toBe('—')
    }
  })
})

// ── La corrección de tecleo ───────────────────────────────────────────────────

describe('proponerCorreccion con un número, no con una cadena', () => {
  it('trata el número como una lectura de tres decimales', () => {
    // `String(438.03)` daba `"438.03"`, el algoritmo metía el punto tres antes
    // del final y salía `43.803`: diez veces menos. Una de cada diez lecturas
    // reales termina en 0 y llegaba deformada.
    expect(proponerCorreccion(483.038, 420.638, 17.0, 81, 60.48)).toEqual({ valor: 438.038, consumo: 17.4 })
    expect(proponerCorreccion('483.038', 420.638, 17.0, 81, 60.48)).toEqual({ valor: 438.038, consumo: 17.4 })
  })

  it('una lectura que acaba en cero no pierde la escala', () => {
    expect(proponerCorreccion(174.7, 100, 70, 200, 120)).toEqual(
      proponerCorreccion('174.700', 100, 70, 200, 120),
    )
  })
})

// ── La suma de los gastos, probada sola ───────────────────────────────────────

describe('sumarMontos · la suma de las líneas de gasto', () => {
  it('suma los montos y redondea a céntimo', () => {
    expect(sumarMontos([{ monto: 1625 }, { monto: 680 }, { monto: 208.33 }])).toBe(2513.33)
  })

  it('un monto en null suma 0: es "por confirmar", no "cuesta cero"', () => {
    expect(sumarMontos([{ monto: 100 }, { monto: null }])).toBe(100)
  })

  it('un monto que llega como cadena NO se concatena', () => {
    // Con `s + (g.monto || 0)`, `3317.98 + "1200"` daba `"3317.981200"` y
    // `round2` lo truncaba a 3317.98: el gasto de S/ 1 200.00 se pintaba en la
    // lista y desaparecía del total, con los dos cuadres en verde.
    const total = sumarMontos([{ monto: 3317.98 }, { monto: '1200' as unknown as number }])
    expect(total).not.toBe(3317.98 + Number('1200'))
    expect(total).toBe(3317.98)
    // Y lo detecta el tercer cuadre, que vuelve a sumar y compara.
    const revision = revisarResultado({
      consumos: Object.fromEntries(DPTOS.map((d) => [d.id, 1])) as never,
      cuotas: Object.fromEntries(
        DPTOS.map((d) => [d.id, { mantenimiento: 1, agua: 1, credito: 0, total: 2, m3: 1, m3medidos: 1, lavado: 0, lecturaAnterior: 0, lecturaActual: 1 }]),
      ) as never,
      precioM3: 4, facturaAgua: 100, comunReal: 1, montoComun: 4, factor: 1,
      totalMes: 3317.98,
      gastos: [{ concepto: 'Portón', monto: '1200' as unknown as number }],
      // El recibo crudo, coherente con `facturaAgua`, para que el defecto que
      // este test busca sea el único que salga en los motivos.
      rec: { aguaM3: 25, aguaMonto: 100, luz: 180, descuento: null },
    })
    expect(revision.cuadra).toBe(false)
    expect(revision.motivos.join(' ')).toContain('Portón')
  })

  for (const toxico of [NaN, Infinity, -Infinity]) {
    it(`un monto ${String(toxico)} no envenena el total`, () => {
      expect(sumarMontos([{ monto: 100 }, { monto: toxico }])).toBe(100)
    })
  }
})
