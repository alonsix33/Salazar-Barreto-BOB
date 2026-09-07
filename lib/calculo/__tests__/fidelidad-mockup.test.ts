/**
 * Comparación numérica contra el mockup · Fase 1, punto 2 del verificador.
 *
 * `fixtures/mockup.json` lo genera `scripts/generar-golden.mjs` ejecutando
 * `mockup/.../datos-edificio.js`, el motor validado contra recibos reales.
 * El fichero **no toca `lib/`**: si esta comparación pasa, es porque el port
 * coincide con el original, no porque se compare consigo mismo.
 *
 * Deben coincidir **al céntimo**. Si algo no coincide, el bug está en el port.
 */

import { describe, expect, it } from 'vitest'
import golden from './fixtures/mockup.json'
import { calcularMesSemilla } from './ayuda'
import { proponerCorreccion } from '../correccion'
import { serieSaldoDerivada, type MesConPagos } from '../saldo'
import { DPTO_IDS } from '../constantes'
import { PAGOS } from '../../semilla'
import type { DptoId, MesId } from '../tipos'

type MesGolden = (typeof golden.meses)[keyof typeof golden.meses]
const meses = golden.meses as Record<string, MesGolden>

describe('fidelidad · los ocho meses de la semilla', () => {
  for (const [mesId, esperado] of Object.entries(meses)) {
    if (esperado === null) {
      it(`${mesId} · el mockup no lo puede calcular y el motor lo marca inválido`, () => {
        expect(calcularMesSemilla(mesId as MesId).valido).toBe(false)
      })
      continue
    }
    describe(mesId, () => {
      const c = calcularMesSemilla(mesId as MesId)

      it('es válido', () => {
        expect(c.valido).toBe(true)
      })

      it('los agregados del mes coinciden', () => {
        expect(c.totalMes).toBe(esperado.totalMes)
        expect(c.baseMant).toBe(esperado.baseMant)
        expect(c.facturaAgua).toBe(esperado.facturaAgua)
        expect(c.precioM3).toBe(esperado.precioM3)
        expect(c.descuento).toBe(esperado.descuento)
        expect(c.sumaMedida).toBe(esperado.sumaMedida)
        expect(c.brutoComun).toBe(esperado.brutoComun)
        expect(c.comunReal).toBe(esperado.comunReal)
        expect(c.lavado).toBe(esperado.lavado)
        expect(c.ajustado).toBe(esperado.ajustado)
        expect(c.factor).toBe(esperado.factor)
        expect(c.montoComun).toBe(esperado.montoComun)
        expect(c.sumaAgua).toBe(esperado.sumaAgua)
        expect(c.sumaCuotas).toBe(esperado.sumaCuotas)
        expect(c.totalCreditos).toBe(esperado.totalCreditos)
        expect(c.cuadraAgua).toBe(esperado.cuadraAgua)
        expect(c.cuadraMes).toBe(esperado.cuadraMes)
        expect(c.cuadra).toBe(esperado.cuadra)
      })

      it('los siete consumos coinciden', () => {
        expect(c.consumos).toEqual(esperado.consumos)
      })

      it('la lista de gastos coincide, concepto por concepto y monto por monto', () => {
        expect(
          c.gastos.map((g) => ({
            concepto: g.concepto,
            monto: g.monto,
            anual: !!g.anual,
            porConfirmar: !!g.porConfirmar,
            esAgua: !!g.esAgua,
          })),
        ).toEqual(esperado.gastos)
      })

      for (const id of DPTO_IDS) {
        it(`la cuota del ${id} coincide al céntimo`, () => {
          const q = c.cuotas[id]
          const e = esperado.cuotas[id as keyof typeof esperado.cuotas]
          expect(q.mantenimiento).toBe(e.mantenimiento)
          expect(q.agua).toBe(e.agua)
          expect(q.credito).toBe(e.credito)
          expect(q.total).toBe(e.total)
          expect(q.m3).toBe(e.m3)
          expect(q.m3medidos).toBe(e.m3medidos)
          expect(q.lavado).toBe(e.lavado)
          expect(q.lecturaAnterior).toBe(e.lecturaAnterior)
          expect(q.lecturaActual).toBe(e.lecturaActual)
        })
      }
    })
  }
})

describe('fidelidad · las variantes con overrides', () => {
  const junio = calcularMesSemilla('2026-06')
  const overrides = {
    'lavado-0': { lavadoM3: 0 },
    'lavado-999': { lavadoM3: 999 },
    'ajustado': { recibo: { aguaM3: 10 } },
    'credito-301-50': { extras: [{ tipo: 'credito' as const, dpto: '301' as DptoId, monto: 50 }] },
    'gasto-porton-700': { extras: [{ tipo: 'gasto' as const, concepto: 'Portón', monto: 700 }] },
    'fijos-todos-null': {
      fijos: {
        'Guardianía · Jorge': null, 'Ascensor': null, 'Mant. bomba': null,
        'Mant. cisterna': null, 'Cerco eléctrico': null, 'Cambio extintor': null,
        'Insumos limpieza': null, 'Pozo a tierra': null,
      },
    },
  }

  for (const [nombre, ov] of Object.entries(overrides)) {
    it(`${nombre} coincide con el mockup`, () => {
      const c = calcularMesSemilla('2026-06', ov)
      const e = golden.variantes[nombre as keyof typeof golden.variantes]!
      expect(c.totalMes).toBe(e.totalMes)
      expect(c.baseMant).toBe(e.baseMant)
      expect(c.brutoComun).toBe(e.brutoComun)
      /**
       * **La única cifra en la que producción se aparta del mockup, a
       * propósito y declarada.**
       *
       * En el reparto ajustado —los medidores midieron más de lo que facturó
       * SEDAPAL— el mockup deja `comunReal` en negativo: −64.88 m³ de «área
       * común». Producción lo pone en 0, porque en ese caso no sobra agua que
       * repartir, sobra medición.
       *
       * No es una mejora de estilo. Un área común negativa hacía dos cosas: se
       * le pintaba al vecino en la hoja «De dónde sale cada monto», y el tercer
       * cuadre la leía como cifra imposible y **bloqueaba la publicación de un
       * mes correcto**. El mockup nunca lo notó porque no publica nada.
       *
       * Lo que **no** cambia, y por eso esto es admisible: `brutoComun` sigue
       * siendo −64.88 exacto, que es el dato que dice cuánto se midió de más, y
       * **las siete cuotas salen idénticas al céntimo**. Se comprueba abajo,
       * como en todas las variantes. Ni un sol cambia de bolsillo.
       */
      if (nombre === 'ajustado') {
        expect(c.ajustado).toBe(true)
        expect(e.comunReal).toBeLessThan(0)
        expect(c.comunReal).toBe(0)
      } else {
        expect(c.comunReal).toBe(e.comunReal)
      }
      expect(c.lavado).toBe(e.lavado)
      expect(c.ajustado).toBe(e.ajustado)
      expect(c.factor).toBe(e.factor)
      expect(c.montoComun).toBe(e.montoComun)
      expect(c.sumaAgua).toBe(e.sumaAgua)
      expect(c.sumaCuotas).toBe(e.sumaCuotas)
      expect(c.totalCreditos).toBe(e.totalCreditos)
      expect(c.cuadraAgua).toBe(e.cuadraAgua)
      expect(c.cuadraMes).toBe(e.cuadraMes)
      // Las variantes comparan los mismos campos que los meses: comparar menos
      // dejaba pasar defectos que solo se ven por una de las dos vías. Ninguna
      // variante toca las lecturas, así que consumos, factura y suma medida
      // tienen que seguir siendo los de junio.
      expect(c.consumos).toEqual(junio.consumos)
      expect(c.sumaMedida).toBe(junio.sumaMedida)
      if (!('recibo' in ov)) expect(c.facturaAgua).toBe(junio.facturaAgua)
      for (const id of DPTO_IDS) {
        const q = c.cuotas[id]
        const eq = e.cuotas[id as keyof typeof e.cuotas]
        expect({ id, ...{ mantenimiento: q.mantenimiento, agua: q.agua, credito: q.credito, total: q.total, m3: q.m3 } })
          .toEqual({ id, ...eq })
        // Estos tres no están en el fixture de variantes: ninguna variante toca
        // las lecturas, así que tienen que ser los de junio en todos los casos.
        expect(q.m3medidos).toBe(junio.consumos[id])
        expect(q.lecturaAnterior).toBe(junio.cuotas[id].lecturaAnterior)
        expect(q.lecturaActual).toBe(junio.cuotas[id].lecturaActual)
      }
    })
  }
})

describe('fidelidad · la serie del saldo derivada hacia atrás', () => {
  it('reproduce la del mockup, mes a mes y al céntimo', () => {
    const MESES_MOCKUP: MesId[] = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
    const conPagos: MesConPagos[] = MESES_MOCKUP.map((mesId) => ({
      mesId,
      resultado: calcularMesSemilla(mesId),
      pagos: PAGOS[mesId] ?? {},
    }))
    expect(serieSaldoDerivada(conPagos)).toEqual(golden.serieSaldoDerivada)
  })
})

describe('fidelidad · proponerCorreccion', () => {
  it('con una sola candidata válida, la devuelve', () => {
    expect(proponerCorreccion('483.038', 420.638, 17.0, 81, 60.48)).toEqual(golden.correcciones.unica)
  })

  it('con dos candidatas válidas, se calla', () => {
    expect(proponerCorreccion('483.038', 451, 15, 70, 40)).toBe(null)
    expect(golden.correcciones.ambigua).toBe(null)
  })

  it('con una lectura muy por debajo de la anterior, no propone nada', () => {
    expect(proponerCorreccion('100.000', 420.638, 17.0, 81, 60.48)).toBe(null)
    expect(golden.correcciones.menorQueAnterior).toBe(null)
  })

  it('con la lectura ya correcta, no propone nada', () => {
    expect(proponerCorreccion('438.038', 420.638, 17.0, 81, 60.48)).toBe(null)
  })

  it('con una lectura por debajo de la anterior pero con un arreglo de un dígito, sí propone', () => {
    // Comportamiento del motor original, conservado a propósito: escribir
    // 400.000 en vez de 440.000 es justamente el error que esto existe para
    // atrapar. Ver docs/verificacion-1.md.
    expect(proponerCorreccion('400.000', 420.638, 17.0, 81, 60.48))
      .toEqual(golden.correcciones.menorConArreglo)
  })
})
