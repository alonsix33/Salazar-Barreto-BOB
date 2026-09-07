(function(){
// Datos reales del edificio Jr. Enrique Salazar Barreto
// Cálculo: mantenimiento por flat %, agua por consumo medido, lavado reasignado del área común.

const DPTOS = [
  { id: '101', nombre: 'Irallys y Aaron',    flat: 11.72, piso: 1 },
  { id: '201', nombre: 'Carlos Mori',        flat: 10.21, piso: 2 },
  { id: '202', nombre: 'Renzo',              flat: 20.11, piso: 2 },
  { id: '301', nombre: 'Deborah y Oscar',    flat: 10.21, piso: 3 },
  { id: '401', nombre: 'Alonso y Julisa',    flat: 10.21, piso: 4 },
  { id: '501', nombre: 'Inmobiliaria',       flat: 17.31, piso: 5 },
  { id: '502', nombre: 'Yara y Gianpierre',  flat: 20.23, piso: 5 },
];

const LAVADO = { dpto: '401', m3: 1.5, desde: '2026-05', concepto: 'lavado de vehículo' };

const FIJOS = [
  { concepto: 'Guardianía · Jorge',  monto: 1625.00 },
  { concepto: 'Ascensor',            monto: 680.00 },
  { concepto: 'Mant. bomba',         monto: 208.33, anual: true },
  { concepto: 'Mant. cisterna',      monto: 50.00,  anual: true },
  { concepto: 'Cerco eléctrico',     monto: 48.75,  anual: true },
  { concepto: 'Cambio extintor',     monto: 32.50,  anual: true },
  { concepto: 'Insumos limpieza',    monto: 30.00 },
  { concepto: 'Pozo a tierra',       monto: null,   porConfirmar: true },
];

// Lecturas de medidor por mes (m³ acumulados)
const LECTURAS = {
  '2025-12': { '101': 146.380, '201': 122.502, '202': 10.840, '301': 330.320, '401': 328.670, '501': 215.800, '502': 155.040 },
  '2026-01': { '101': 151.851, '201': 131.513, '202': 12.878, '301': 346.625, '401': 343.795, '501': 218.160, '502': 175.530 },
  '2026-02': { '101': 158.455, '201': 141.739, '202': 15.434, '301': 364.626, '401': 359.453, '501': 220.823, '502': 199.922 },
  '2026-03': { '101': 164.219, '201': 151.132, '202': 17.675, '301': 380.743, '401': 374.396, '501': 223.278, '502': 221.909 },
  '2026-04': { '101': 169.465, '201': 159.803, '202': 19.816, '301': 396.052, '401': 388.741, '501': 225.526, '502': 242.249 },
  '2026-05': { '101': 174.699, '201': 168.458, '202': 27.264, '301': 411.048, '401': 403.234, '501': 227.941, '502': 263.888 },
  '2026-06': { '101': 180.230, '201': 177.387, '202': 35.112, '301': 426.921, '401': 420.638, '501': 230.386, '502': 280.748 },
  '2026-07': { '101': 186.461, '201': 185.256, '202': 52.513, '301': 441.532, '401': 438.038, '501': 232.826, '502': 292.678 },
};

const RECIBOS = {
  '2025-12': { aguaM3: 72, aguaMonto: 299.90, luz: 284.50 },
  '2026-01': { aguaM3: 74, aguaMonto: 308.20, luz: 289.10 },
  '2026-02': { aguaM3: 83, aguaMonto: 346.30, luz: 294.60 },
  '2026-03': { aguaM3: 76, aguaMonto: 317.10, luz: 291.20 },
  '2026-04': { aguaM3: 71, aguaMonto: 296.40, luz: 298.40 },
  '2026-05': { aguaM3: 78, aguaMonto: 325.00, luz: 276.20, descuento: 17.33 },
  '2026-06': { aguaM3: 78, aguaMonto: 325.00, luz: 318.40 },
  '2026-07': { aguaM3: 81, aguaMonto: 338.60, luz: 361.20 },
};

// estado: 'confirmado' | 'aviso' | null
const PAGOS = {
  '2026-01': {
    '101': { estado: 'confirmado', fecha: '9 ene', op: '0039140' },
    '201': { estado: 'confirmado', fecha: '6 ene', op: '0039180' },
    '202': { estado: 'confirmado', fecha: '12 ene', op: '0039221' },
    '301': { estado: 'confirmado', fecha: '2 ene', op: '0039261' },
    '401': { estado: 'confirmado', fecha: '7 ene', op: '0039301' },
    '501': { estado: 'confirmado', fecha: '27 ene', op: '0039341' },
    '502': { estado: 'confirmado', fecha: '4 ene', op: '0039382' },
  },
  '2026-02': {
    '101': { estado: 'confirmado', fecha: '11 feb', op: '0039422' },
    '201': { estado: 'confirmado', fecha: '5 feb', op: '0039462' },
    '202': { estado: 'confirmado', fecha: '9 feb', op: '0039503' },
    '301': { estado: 'confirmado', fecha: '3 feb', op: '0039543' },
    '401': { estado: 'confirmado', fecha: '6 feb', op: '0039583' },
    '501': { estado: 'confirmado', fecha: '26 feb', op: '0039623' },
    '502': { estado: 'confirmado', fecha: '4 feb', op: '0039664' },
  },
  '2026-03': {
    '101': { estado: 'confirmado', fecha: '8 mar', op: '0039704' },
    '201': { estado: 'confirmado', fecha: '7 mar', op: '0039744' },
    '202': { estado: 'confirmado', fecha: '13 mar', op: '0039785' },
    '301': { estado: 'confirmado', fecha: '2 mar', op: '0039825' },
    '401': { estado: 'confirmado', fecha: '5 mar', op: '0039865' },
    '501': { estado: 'confirmado', fecha: '28 mar', op: '0039905' },
    '502': { estado: 'confirmado', fecha: '6 mar', op: '0039946' },
  },
  '2026-04': {
    '101': { estado: 'confirmado', fecha: '10 abr', op: '0039986' },
    '201': { estado: 'confirmado', fecha: '4 abr', op: '0040026' },
    '202': { estado: 'confirmado', fecha: '8 abr', op: '0040067' },
    '301': { estado: 'confirmado', fecha: '2 abr', op: '0040107' },
    '401': { estado: 'confirmado', fecha: '9 abr', op: '0040147' },
    '501': { estado: 'confirmado', fecha: '27 abr', op: '0040187' },
    '502': { estado: 'confirmado', fecha: '3 abr', op: '0040228' },
  },
  '2026-05': {
    '101': { estado: 'confirmado', fecha: '6 may',  op: '0041880' },
    '201': { estado: 'confirmado', fecha: '9 may',  op: '0041955' },
    '202': { estado: 'confirmado', fecha: '3 may',  op: '0041790' },
    '301': { estado: 'confirmado', fecha: '2 may',  op: '0041744' },
    '401': { estado: 'confirmado', fecha: '7 may',  op: '0041902' },
    '501': { estado: 'confirmado', fecha: '28 may', op: '0042510' },
    '502': { estado: 'confirmado', fecha: '5 may',  op: '0041861' },
  },
  '2026-06': {
    '101': { estado: 'confirmado', fecha: '14 jun', op: '0043390' },
    '201': { estado: 'aviso',      fecha: '24 jul', op: '0044921', texto: 'Transferí el 24 de julio, operación 0044921.' },
    '202': { estado: 'confirmado', fecha: '9 jun',  op: '0043211' },
    '301': { estado: 'confirmado', fecha: '2 jun',  op: '0043002' },
    '401': { estado: 'confirmado', fecha: '8 jun',  op: '0043178' },
    '501': null,
    '502': { estado: 'confirmado', fecha: '4 jun',  op: '0043055' },
  },
  '2026-07': {},
};

const MESES = [
  { id: '2026-01', label: 'Enero 2026',   corto: 'ENE' },
  { id: '2026-02', label: 'Febrero 2026', corto: 'FEB' },
  { id: '2026-03', label: 'Marzo 2026',   corto: 'MAR' },
  { id: '2026-04', label: 'Abril 2026',   corto: 'ABR' },
  { id: '2026-05', label: 'Mayo 2026',    corto: 'MAY' },
  { id: '2026-06', label: 'Junio 2026',   corto: 'JUN' },
];

const SALDO_BASE = 4182.40;

const mesAnterior = (id) => {
  const [a, m] = id.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};

/** Motor de cálculo. Devuelve todo lo que una pantalla puede necesitar de un mes. */
function calcularMes(mesId, ov) {
  ov = ov || {};
  const recBase = RECIBOS[mesId];
  const lecBase = LECTURAS[mesId];
  const lecAnt = LECTURAS[mesAnterior(mesId)];
  if (!recBase || !lecAnt) return null;

  // lo que el administrador escribió pisa la semilla, campo por campo
  const rec = {
    aguaM3: ov.recibo && ov.recibo.aguaM3 != null ? ov.recibo.aguaM3 : recBase.aguaM3,
    aguaMonto: ov.recibo && ov.recibo.aguaMonto != null ? ov.recibo.aguaMonto : recBase.aguaMonto,
    luz: ov.recibo && ov.recibo.luz != null ? ov.recibo.luz : recBase.luz,
    descuento: ov.recibo && ov.recibo.descuento != null ? ov.recibo.descuento : recBase.descuento,
  };
  const lecAct = {};
  DPTOS.forEach(d => {
    const esc = ov.lecturas && ov.lecturas[d.id] != null ? ov.lecturas[d.id] : null;
    lecAct[d.id] = esc != null ? esc : (lecBase ? lecBase[d.id] : lecAnt[d.id]);
  });

  const consumos = {};
  let sumaMedida = 0;
  DPTOS.forEach(d => {
    const c = Math.round((lecAct[d.id] - lecAnt[d.id]) * 100) / 100;
    consumos[d.id] = c;
    sumaMedida += c;
  });
  sumaMedida = Math.round(sumaMedida * 100) / 100;

  const facturaAgua = Math.round((rec.aguaMonto - (rec.descuento || 0)) * 100) / 100;
  const precioM3 = facturaAgua / rec.aguaM3;
  const brutoComun = Math.round((rec.aguaM3 - sumaMedida) * 100) / 100;

  // Reparto ajustado: los medidores midieron más de lo facturado
  const ajustado = brutoComun < 0;
  const factor = ajustado ? rec.aguaM3 / sumaMedida : 1;

  // El lavado sale del caño común: se reasigna, no se suma
  const lavM3 = ov.lavadoM3 != null ? ov.lavadoM3 : LAVADO.m3;
  const lavado = (!ajustado && lavM3 > 0 && brutoComun >= lavM3 && mesId >= LAVADO.desde) ? lavM3 : 0;
  const comunReal = Math.round((brutoComun - lavado) * 100) / 100;

  const m3Cobrados = {}, montoAgua = {};
  DPTOS.forEach(d => {
    const extra = d.id === LAVADO.dpto ? lavado : 0;
    const m3 = Math.round((consumos[d.id] * factor + extra) * 100) / 100;
    m3Cobrados[d.id] = m3;
    montoAgua[d.id] = Math.round(m3 * precioM3 * 100) / 100;
  });

  const montoComun = ajustado ? 0 : Math.round(comunReal * precioM3 * 100) / 100;

  // Gastos: fijos + luz + agua
  const ed = ov.fijos || {};
  const mf = (concepto, base) => ed[concepto] !== undefined ? ed[concepto] : base;
  const gastos = [
    { concepto: 'Guardianía · Jorge', monto: mf('Guardianía · Jorge', 1625.00) },
    { concepto: 'Ascensor', monto: mf('Ascensor', 680.00) },
    { concepto: 'Factura de agua SEDAPAL', monto: facturaAgua, esAgua: true },
    { concepto: 'Recibo de luz común', monto: rec.luz },
    { concepto: 'Mant. bomba', monto: mf('Mant. bomba', 208.33), anual: true },
    { concepto: 'Mant. cisterna', monto: mf('Mant. cisterna', 50.00), anual: true },
    { concepto: 'Cerco eléctrico', monto: mf('Cerco eléctrico', 48.75), anual: true },
    { concepto: 'Cambio extintor', monto: mf('Cambio extintor', 32.50), anual: true },
    { concepto: 'Insumos limpieza', monto: mf('Insumos limpieza', 30.00) },
    { concepto: 'Pozo a tierra', monto: mf('Pozo a tierra', null), porConfirmar: mf('Pozo a tierra', null) == null },
  ];
  (ov.extras || []).forEach(e => {
    if (e.tipo === 'gasto') gastos.push({ concepto: e.concepto, monto: e.monto, extra: true });
  });
  const totalMes = Math.round(gastos.reduce((s, g) => s + (g.monto || 0), 0) * 100) / 100;
  const baseMant = Math.round((totalMes - facturaAgua) * 100) / 100;

  const creditos = {};
  (ov.extras || []).forEach(e => { if (e.tipo === 'credito' && e.dpto) creditos[e.dpto] = (creditos[e.dpto] || 0) + e.monto; });

  const cuotas = {};
  DPTOS.forEach(d => {
    const mant = Math.round(baseMant * d.flat) / 100;
    const cred = creditos[d.id] || 0;
    cuotas[d.id] = {
      credito: cred,
      mantenimiento: Math.round(mant * 100) / 100,
      agua: montoAgua[d.id],
      m3: m3Cobrados[d.id],
      m3medidos: consumos[d.id],
      lavado: d.id === LAVADO.dpto ? lavado : 0,
      total: Math.round((mant + montoAgua[d.id] - cred) * 100) / 100,
      lecturaAnterior: lecAnt[d.id],
      lecturaActual: lecAct[d.id],
    };
  });

  const sumaAgua = Math.round(DPTOS.reduce((s, d) => s + montoAgua[d.id], 0) * 100) / 100;
  const cuadraAgua = Math.abs(sumaAgua + montoComun - facturaAgua) < 0.03;

  // los créditos salen del saldo de la cuenta, no de los demás vecinos
  const totalCreditos = Math.round(DPTOS.reduce((s, d) => s + (cuotas[d.id].credito || 0), 0) * 100) / 100;
  const sumaCuotas = Math.round(DPTOS.reduce((s, d) => s + cuotas[d.id].total, 0) * 100) / 100;
  const cuadraMes = Math.abs(sumaCuotas + montoComun + totalCreditos - totalMes) < 0.05;
  const cuadra = cuadraAgua && cuadraMes;

  return {
    mesId, rec, consumos, sumaMedida, facturaAgua, precioM3,
    brutoComun, comunReal, lavado, ajustado, factor,
    montoComun, gastos, totalMes, baseMant, cuotas, sumaAgua, cuadra, cuadraAgua, cuadraMes, totalCreditos, sumaCuotas,
    descuento: rec.descuento || 0,
  };
}

/** Serie real del saldo mes a mes, anclada a que el último mes cierre en SALDO_BASE. */
function serieSaldo() {
  const deltas = MESES.map(m => {
    const c = calcularMes(m.id);
    if (!c) return { recibido: 0, gastado: 0, delta: 0 };
    const pagos = PAGOS[m.id] || {};
    const recibido = Math.round(DPTOS.reduce((s, d) => {
      const p = pagos[d.id];
      return s + (p && p.estado === 'confirmado' ? c.cuotas[d.id].total : 0);
    }, 0) * 100) / 100;
    return { recibido, gastado: c.totalMes, delta: Math.round((recibido - c.totalMes) * 100) / 100 };
  });
  // el saldo inicial se deriva para que el cierre del último mes sea SALDO_BASE
  const totalDelta = deltas.reduce((s, x) => s + x.delta, 0);
  let saldo = Math.round((SALDO_BASE - totalDelta) * 100) / 100;
  return deltas.map((x, n) => {
    saldo = Math.round((saldo + x.delta) * 100) / 100;
    return { mes: MESES[n].id, corto: MESES[n].corto, recibido: x.recibido, gastado: x.gastado, delta: x.delta, saldo };
  });
}

function saldoAl(mesId) {
  const serie = serieSaldo();
  const fila = serie.find(x => x.mes === mesId);
  return fila || { recibido: 0, gastado: 0, saldo: SALDO_BASE, delta: 0 };
}

fmt = (n) => n == null ? '—' : n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n) => n == null ? '—' : n.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmt2 = (n) => n == null ? '—' : n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Genera correcciones a un error de distancia y devuelve la única que cuadra, si existe. */
function proponerCorreccion(valorTecleado, anterior, promedio, objetivoM3, otrosM3) {
  const s = String(valorTecleado).replace('.', '');
  const cands = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    const a = s.split(''); [a[i], a[i + 1]] = [a[i + 1], a[i]]; cands.add(a.join(''));
  }
  for (let i = 0; i < s.length; i++) {
    for (let d = 0; d <= 9; d++) { const a = s.split(''); a[i] = String(d); cands.add(a.join('')); }
  }
  const validas = [];
  cands.forEach(c => {
    const v = Number(c.slice(0, -3) + '.' + c.slice(-3));
    if (!(v > anterior)) return;
    const cons = v - anterior;
    if (cons > promedio * 2 || cons < promedio * 0.2) return;
    const dif = objetivoM3 - (otrosM3 + cons);
    if (dif < 0 || dif > objetivoM3 * 0.08) return;
    validas.push({ valor: v, consumo: Math.round(cons * 100) / 100 });
  });
  return validas.length === 1 ? validas[0] : null;
}

window.__EDIF__ = { DPTOS, LAVADO, FIJOS, LECTURAS, RECIBOS, PAGOS, MESES, SALDO_BASE, calcularMes, saldoAl, serieSaldo, fmt, fmt2, fmt3, proponerCorreccion };

})();