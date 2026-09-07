/**
 * Genera el fichero de referencia contra el que la Fase 1 compara al céntimo.
 *
 * Ejecuta `mockup/.../datos-edificio.js` —el motor validado contra recibos
 * reales— y vuelca lo que devuelve. **No importa nada de `lib/`**: si lo
 * hiciera, la comparación sería el motor contra sí mismo y no probaría nada.
 *
 *   node scripts/generar-golden.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const FUENTE = path.join(
  RAIZ,
  'mockup/design_handoff_edificio_salazar_barreto/datos-edificio.js',
)
const DESTINO = path.join(RAIZ, 'lib/calculo/__tests__/fixtures/mockup.json')

globalThis.window = {}
new Function(fs.readFileSync(FUENTE, 'utf8'))()
const D = globalThis.window.__EDIF__
if (!D) throw new Error('datos-edificio.js no expuso __EDIF__')

const MESES = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']

const meses = {}
for (const mes of MESES) {
  const c = D.calcularMes(mes)
  meses[mes] = c === null ? null : {
    totalMes: c.totalMes, baseMant: c.baseMant, facturaAgua: c.facturaAgua,
    precioM3: c.precioM3, descuento: c.descuento,
    sumaMedida: c.sumaMedida, brutoComun: c.brutoComun, comunReal: c.comunReal,
    lavado: c.lavado, ajustado: c.ajustado, factor: c.factor, montoComun: c.montoComun,
    sumaAgua: c.sumaAgua, sumaCuotas: c.sumaCuotas, totalCreditos: c.totalCreditos,
    cuadraAgua: c.cuadraAgua, cuadraMes: c.cuadraMes, cuadra: c.cuadra,
    consumos: c.consumos,
    gastos: c.gastos.map((g) => ({
      concepto: g.concepto, monto: g.monto,
      anual: !!g.anual, porConfirmar: !!g.porConfirmar, esAgua: !!g.esAgua,
    })),
    cuotas: Object.fromEntries(Object.entries(c.cuotas).map(([id, q]) => [id, {
      mantenimiento: q.mantenimiento, agua: q.agua, credito: q.credito, total: q.total,
      m3: q.m3, m3medidos: q.m3medidos, lavado: q.lavado,
      lecturaAnterior: q.lecturaAnterior, lecturaActual: q.lecturaActual,
    }])),
  }
}

// Variantes con overrides: son los caminos que los casos de §10 ejercitan.
const variantes = {
  'lavado-0': D.calcularMes('2026-06', { lavadoM3: 0 }),
  'lavado-999': D.calcularMes('2026-06', { lavadoM3: 999 }),
  'ajustado': D.calcularMes('2026-06', { recibo: { aguaM3: 10 } }),
  'credito-301-50': D.calcularMes('2026-06', { extras: [{ tipo: 'credito', dpto: '301', monto: 50 }] }),
  'gasto-porton-700': D.calcularMes('2026-06', { extras: [{ tipo: 'gasto', concepto: 'Portón', monto: 700 }] }),
  'fijos-todos-null': D.calcularMes('2026-06', {
    fijos: {
      'Guardianía · Jorge': null, 'Ascensor': null, 'Mant. bomba': null,
      'Mant. cisterna': null, 'Cerco eléctrico': null, 'Cambio extintor': null,
      'Insumos limpieza': null, 'Pozo a tierra': null,
    },
  }),
}
const variantesPlanas = Object.fromEntries(
  Object.entries(variantes).map(([k, c]) => [k, c === null ? null : {
    totalMes: c.totalMes, baseMant: c.baseMant, comunReal: c.comunReal, brutoComun: c.brutoComun,
    lavado: c.lavado, ajustado: c.ajustado, factor: c.factor, montoComun: c.montoComun,
    sumaAgua: c.sumaAgua, sumaCuotas: c.sumaCuotas, totalCreditos: c.totalCreditos,
    cuadraAgua: c.cuadraAgua, cuadraMes: c.cuadraMes,
    cuotas: Object.fromEntries(Object.entries(c.cuotas).map(([id, q]) => [id, {
      mantenimiento: q.mantenimiento, agua: q.agua, credito: q.credito, total: q.total, m3: q.m3,
    }])),
  }]),
)

const salida = {
  _origen: 'mockup/design_handoff_edificio_salazar_barreto/datos-edificio.js',
  _generadoPor: 'scripts/generar-golden.mjs',
  _nota: 'Referencia del motor del mockup. No editar a mano: regenerar.',
  meses,
  variantes: variantesPlanas,
  serieSaldoDerivada: D.serieSaldo(),
  correcciones: {
    // Una sola candidata válida: la transposición de julio del 401.
    unica: D.proponerCorreccion('483.038', 420.638, 17.0, 81, 60.48),
    // Dos candidatas válidas (480.038 y 480.338): se calla.
    ambigua: D.proponerCorreccion('483.038', 451, 15, 70, 40),
    // Lectura muy por debajo de la anterior: ninguna variante de un dígito vale.
    menorQueAnterior: D.proponerCorreccion('100.000', 420.638, 17.0, 81, 60.48),
    // Lectura correcta: no hay nada que proponer.
    yaCorrecta: D.proponerCorreccion('438.038', 420.638, 17.0, 81, 60.48),
    // Una lectura por debajo de la anterior con un arreglo de un dígito posible:
    // el motor SÍ lo propone. Ver docs/verificacion-1.md.
    menorConArreglo: D.proponerCorreccion('400.000', 420.638, 17.0, 81, 60.48),
  },
}
fs.mkdirSync(path.dirname(DESTINO), { recursive: true })
fs.writeFileSync(DESTINO, JSON.stringify(salida, null, 1) + '\n')
console.log(`Escrito ${DESTINO}`)
