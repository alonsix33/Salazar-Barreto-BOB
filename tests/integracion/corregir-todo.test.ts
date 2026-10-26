/**
 * Corregir un mes ya publicado: todo lo que entra en el cálculo, no solo las
 * lecturas.
 *
 * El caso que lo pidió: la administradora cierra octubre y después llega un
 * gasto de S/ 450 que es de octubre. Y el defecto que apareció al probarlo: si
 * la cuota sube, el pago confirmado «sin monto» sube con ella y quien ya pagó
 * queda «al día» por una plata que no puso.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes, fijosVigentesEn } from '@/lib/datos/mes'
import { balanceDelDpto } from '@/lib/datos/meses'
import { corregirMes } from '@/lib/servicios/cierre'
import { confirmarPago } from '@/lib/servicios/pagos'
import { round2 } from '@/lib/calculo/redondeo'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import type { MesId, ResultadoMes } from '@/lib/calculo/tipos'
import { prisma, resembrar } from './entorno'

const MES = '2026-06' as MesId
const SIGUIENTE = '2026-07' as MesId

async function valido(mes: MesId = MES) {
  const r: ResultadoMes = await resultadoDeMes(mes)
  if (!r.valido) throw new Error(`${mes} no válido`)
  return r
}

const gasto450 = [{ tipo: 'gasto' as const, concepto: 'Reparación de la bomba', monto: 450 }]

describe('corregir un mes publicado: gastos puntuales', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('un gasto de S/ 450 en un mes cerrado se reparte por porcentaje, cuadra y avisa', async () => {
    const antes = await valido()
    const hecha = await corregirMes(MES, { extras: gasto450, motivo: 'Llegó la factura de la bomba.' })
    const despues = await valido()

    expect(round2(despues.totalMes - antes.totalMes)).toBe(450)
    expect(despues.cuadra).toBe(true)
    // Cada cuota sube su parte, y las partes suman los 450 (±céntimos de redondeo).
    const subida = DPTO_IDS.reduce((s, d) => s + (despues.cuotas[d].total - antes.cuotas[d].total), 0)
    expect(Math.abs(subida - 450)).toBeLessThan(0.05)
    expect(hecha.cuotasQueCambiaron).toBe(7)

    const aviso = await prisma.aviso.findFirstOrThrow({ where: { mes: MES, tipo: 'correccion' } })
    expect(aviso.titulo).toContain('gastos puntuales')
    expect(aviso.detalle).toContain('Llegó la factura de la bomba.')
    const apunte = await prisma.auditoria.findFirst({
      where: { mes: MES, entidad: 'gastoExtra', accion: 'corregir' },
    })
    expect(apunte?.valorNuevo).toContain('Reparación de la bomba')
    // La instantánea es la nueva cuota oficial.
    const cierre = await prisma.cierre.findUniqueOrThrow({ where: { mes: MES } })
    expect((cierre.instantanea as unknown as ResultadoMes).totalMes).toBe(despues.totalMes)
  })

  it('quitar un gasto que había baja las cuotas', async () => {
    await corregirMes(MES, { extras: gasto450, motivo: 'm' })
    const con = await valido()
    await corregirMes(MES, { extras: [], motivo: 'Se anuló la factura.' })
    const sin = await valido()
    expect(round2(con.totalMes - sin.totalMes)).toBe(450)
  })

  it('la misma lista no es una corrección: no escribe, no audita y no avisa', async () => {
    await corregirMes(MES, { extras: gasto450, motivo: 'm' })
    const avisos = await prisma.aviso.count({ where: { tipo: 'correccion' } })
    await expect(corregirMes(MES, { extras: gasto450, motivo: 'otra vez' })).rejects.toMatchObject({
      estado: 400,
    })
    expect(await prisma.aviso.count({ where: { tipo: 'correccion' } })).toBe(avisos)
  })

  it('un gasto que solo pagan algunos respeta quiénes lo pagan', async () => {
    const antes = await valido()
    await corregirMes(MES, {
      extras: [{ tipo: 'gasto', concepto: 'Portón', monto: 300, participantes: ['201', '202'] }],
      motivo: 'Portón del garaje.',
    })
    const despues = await valido()
    expect(despues.cuotas['101'].total).toBe(antes.cuotas['101'].total)
    expect(despues.cuotas['201'].total).toBeGreaterThan(antes.cuotas['201'].total)
  })

  it('un crédito baja la cuota de un solo departamento', async () => {
    const antes = await valido()
    await corregirMes(MES, {
      extras: [{ tipo: 'credito', concepto: 'Adelanto', monto: 20, dpto: '301' }],
      motivo: 'Adelantó una compra.',
    })
    const despues = await valido()
    expect(despues.cuotas['301'].total).toBeLessThan(antes.cuotas['301'].total)
  })
})

describe('quien ya pagó queda con lo que de verdad puso', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('pagó justo (sin monto): si la cuota sube, le queda la diferencia por poner', async () => {
    const antes = await valido()
    const cuotaVieja = antes.cuotas['101'].total
    expect(await balanceDelDpto('101')).toBe(0)

    await corregirMes(MES, { extras: gasto450, motivo: 'Gasto de la bomba.' })
    const despues = await valido()

    const pago = await prisma.pago.findUniqueOrThrow({ where: { mes_dptoId: { mes: MES, dptoId: '101' } } })
    expect(Number(pago.monto)).toBe(cuotaVieja)
    expect(await balanceDelDpto('101')).toBe(round2(cuotaVieja - despues.cuotas['101'].total))
    expect(await balanceDelDpto('101')).toBeLessThan(0)
  })

  it('pagó 300 explícitos: se queda en 300, no se toca', async () => {
    await resembrar()
    await prisma.pago.update({
      where: { mes_dptoId: { mes: MES, dptoId: '101' } },
      data: { monto: 300 },
    })
    await corregirMes(MES, { extras: gasto450, motivo: 'm' })
    const pago = await prisma.pago.findUniqueOrThrow({ where: { mes_dptoId: { mes: MES, dptoId: '101' } } })
    expect(Number(pago.monto)).toBe(300)
  })

  it('si la cuota baja, lo que puso queda como saldo a favor', async () => {
    await corregirMes(MES, { extras: gasto450, motivo: 'm' })
    const alta = (await valido()).cuotas['101'].total
    await corregirMes(MES, { extras: [], motivo: 'Se anuló.' })
    const baja = (await valido()).cuotas['101'].total
    // El pago se congeló en la cuota de antes de la primera corrección; con la
    // segunda ya está fijo, y lo que puso supera la cuota nueva.
    expect(await balanceDelDpto('101')).toBeGreaterThanOrEqual(0)
    expect(baja).toBeLessThan(alta)
  })

  it('quien solo avisó, o no pagó, no recibe un monto inventado', async () => {
    await corregirMes(MES, { extras: gasto450, motivo: 'm' })
    const avisado = await prisma.pago.findUniqueOrThrow({ where: { mes_dptoId: { mes: MES, dptoId: '201' } } })
    expect(avisado.estado).toBe('aviso')
    expect(avisado.monto).toBeNull()
    expect(await prisma.pago.findUnique({ where: { mes_dptoId: { mes: MES, dptoId: '501' } } })).toBeNull()
  })

  it('una cuota que no cambia no toca el pago de nadie', async () => {
    // Solo el crédito del 301 cambia cuotas del 301 y de nadie más (es un crédito).
    await corregirMes(MES, {
      extras: [{ tipo: 'credito', concepto: 'Adelanto', monto: 10, dpto: '301' }],
      motivo: 'm',
    })
    const pago101 = await prisma.pago.findUniqueOrThrow({ where: { mes_dptoId: { mes: MES, dptoId: '101' } } })
    // El crédito sale del saldo común, no del bolsillo de los demás.
    const r = await valido()
    expect(pago101.monto === null || Number(pago101.monto) === r.cuotas['101'].total).toBe(true)
  })

  it('un pago confirmado después de la corrección va por la cuota nueva', async () => {
    await corregirMes(MES, { extras: gasto450, motivo: 'm' })
    await confirmarPago({ mes: MES, dpto: '501' })
    expect(await balanceDelDpto('501')).toBe(0)
  })
})

describe('gastos fijos de un mes publicado: solo ese mes', () => {
  beforeEach(async () => {
    await resembrar()
  })

  const ascensor = (monto: number | null, extra = {}) => [{ concepto: 'Ascensor', monto, ...extra }]

  it('el mes corregido cambia y el siguiente queda como estaba', async () => {
    const julioAntes = await fijosVigentesEn(SIGUIENTE)
    const junioAntes = await valido()

    await corregirMes(MES, { fijos: ascensor(900), motivo: 'El ascensor costó más.' })

    const junio = (await fijosVigentesEn(MES)).find((f) => f.concepto === 'Ascensor')
    expect(junio?.monto).toBe(900)
    expect((await valido()).totalMes).toBeGreaterThan(junioAntes.totalMes)
    expect(await fijosVigentesEn(SIGUIENTE)).toEqual(julioAntes)
    // Y la fila que lo asegura está escrita.
    expect(await prisma.gastoFijo.count({ where: { concepto: 'Ascensor', vigenteDesde: SIGUIENTE } })).toBe(1)
  })

  it('corregirlo dos veces no duplica la fila de restauración', async () => {
    await corregirMes(MES, { fijos: ascensor(900), motivo: 'a' })
    await corregirMes(MES, { fijos: ascensor(950), motivo: 'b' })
    expect(await prisma.gastoFijo.count({ where: { concepto: 'Ascensor', vigenteDesde: SIGUIENTE } })).toBe(1)
    const restaurada = await prisma.gastoFijo.findFirstOrThrow({
      where: { concepto: 'Ascensor', vigenteDesde: SIGUIENTE },
    })
    expect(Number(restaurada.monto)).toBe(680)
  })

  it('apagar un fijo solo ese mes: el siguiente vuelve a cobrarlo', async () => {
    await corregirMes(MES, { fijos: ascensor(680, { activo: false }), motivo: 'No se cobró.' })
    expect((await fijosVigentesEn(MES)).some((f) => f.concepto === 'Ascensor')).toBe(false)
    expect((await fijosVigentesEn(SIGUIENTE)).some((f) => f.concepto === 'Ascensor')).toBe(true)
  })

  it('monto 0 y «por confirmar» son cosas distintas', async () => {
    await corregirMes(MES, { fijos: ascensor(0), motivo: 'a' })
    expect((await fijosVigentesEn(MES)).find((f) => f.concepto === 'Ascensor')?.monto).toBe(0)
    await corregirMes(MES, { fijos: ascensor(null), motivo: 'b' })
    const f = (await fijosVigentesEn(MES)).find((x) => x.concepto === 'Ascensor')
    expect(f?.monto).toBeNull()
    expect(f?.porConfirmar).toBe(true)
  })

  it('un mes posterior que ya tenía su propia fila no se toca', async () => {
    // Un cambio real desde julio: 700. Corregir junio no debe moverlo.
    await prisma.gastoFijo.create({
      data: { concepto: 'Ascensor', monto: 700, anual: false, activo: true, vigenteDesde: SIGUIENTE, orden: 2 },
    })
    await corregirMes(MES, { fijos: ascensor(900), motivo: 'a' })
    expect((await fijosVigentesEn(SIGUIENTE)).find((f) => f.concepto === 'Ascensor')?.monto).toBe(700)
    expect(await prisma.gastoFijo.count({ where: { concepto: 'Ascensor', vigenteDesde: SIGUIENTE } })).toBe(1)
  })

  it('el primer mes de la serie se puede corregir', async () => {
    await corregirMes('2026-01' as MesId, { fijos: ascensor(900), motivo: 'a' })
    expect((await fijosVigentesEn('2026-01' as MesId)).find((f) => f.concepto === 'Ascensor')?.monto).toBe(900)
    expect((await fijosVigentesEn('2026-02' as MesId)).find((f) => f.concepto === 'Ascensor')?.monto).toBe(680)
  })

  it('un concepto que no existe se rechaza: un gasto nuevo es un gasto puntual', async () => {
    await expect(
      corregirMes(MES, { fijos: [{ concepto: 'Inventado', monto: 10 }], motivo: 'a' }),
    ).rejects.toMatchObject({ estado: 400 })
  })
})

describe('recibo, lavado y los bordes', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('corregir el recibo de SEDAPAL y la luz, junto con un gasto, en una sola corrección', async () => {
    const antes = await valido()
    const hecha = await corregirMes(MES, {
      recibo: { luz: antes.rec.luz + 40 },
      extras: gasto450,
      motivo: 'Luz y bomba.',
    })
    expect(hecha.cambios.map((c) => c.que)).toEqual(['el recibo de luz', 'los gastos puntuales'])
    expect(await prisma.aviso.count({ where: { mes: MES, tipo: 'correccion' } })).toBe(1)
  })

  it('el descuento mayor que la factura se rechaza y no escribe nada', async () => {
    const antes = await valido()
    await expect(
      corregirMes(MES, { recibo: { descuento: antes.rec.aguaMonto + 1 }, extras: gasto450, motivo: 'a' }),
    ).rejects.toMatchObject({ estado: 400 })
    // La transacción entera se deshizo: tampoco quedó el gasto.
    expect(await prisma.gastoExtra.count({ where: { mes: MES } })).toBe(0)
  })

  it('una corrección que deja el mes sin cuadrar se rechaza entera', async () => {
    await expect(
      corregirMes(MES, { recibo: { aguaM3: 0 }, extras: gasto450, motivo: 'a' }),
    ).rejects.toMatchObject({ estado: 409 })
    expect(await prisma.gastoExtra.count({ where: { mes: MES } })).toBe(0)
    expect(await prisma.aviso.count({ where: { tipo: 'correccion' } })).toBe(0)
  })

  it('sin ningún cambio no hay corrección', async () => {
    await expect(corregirMes(MES, { motivo: 'nada' })).rejects.toMatchObject({ estado: 400 })
  })

  it('un mes sin publicar no se corrige: se edita desde el cierre', async () => {
    await expect(corregirMes(SIGUIENTE, { extras: gasto450, motivo: 'a' })).rejects.toMatchObject({
      estado: 409,
    })
  })

  it('una versión vieja se rechaza', async () => {
    await corregirMes(MES, { extras: gasto450, motivo: 'a', version: (await prisma.cierre.findUniqueOrThrow({ where: { mes: MES } })).version })
    await expect(corregirMes(MES, { extras: [], motivo: 'b', version: 0 })).rejects.toMatchObject({
      estado: 409,
    })
  })

  it('desactivar el lavado de un mes publicado y volver a activarlo', async () => {
    const con = await valido()
    expect(con.cuotas['401'].lavado).toBeGreaterThan(0)
    await corregirMes(MES, { lavado: { activa: false }, motivo: 'No se lavó.' })
    expect((await valido()).cuotas['401'].lavado).toBe(0)
    await corregirMes(MES, { lavado: { activa: true }, motivo: 'Sí se lavó.' })
    expect((await valido()).cuotas['401'].lavado).toBe(con.cuotas['401'].lavado)
  })
})

describe('la vista previa es la corrección, sin guardar', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('enseña las mismas cuotas que después guarda, y no deja rastro', async () => {
    const cierre0 = await prisma.cierre.findUniqueOrThrow({ where: { mes: MES } })
    const avisos0 = await prisma.aviso.count()
    const auditoria0 = await prisma.auditoria.count()

    const previa = await corregirMes(
      MES, { extras: gasto450, fijos: [{ concepto: 'Ascensor', monto: 900 }], motivo: '', version: cierre0.version },
      { simular: true },
    )

    expect(await prisma.gastoExtra.count({ where: { mes: MES } })).toBe(0)
    expect(await prisma.aviso.count()).toBe(avisos0)
    expect(await prisma.auditoria.count()).toBe(auditoria0)
    expect(await prisma.gastoFijo.count({ where: { concepto: 'Ascensor', vigenteDesde: SIGUIENTE } })).toBe(0)
    expect((await prisma.cierre.findUniqueOrThrow({ where: { mes: MES } })).version).toBe(cierre0.version)
    const pago = await prisma.pago.findUniqueOrThrow({ where: { mes_dptoId: { mes: MES, dptoId: '101' } } })
    expect(pago.monto).toBeNull()

    const real = await corregirMes(MES, {
      extras: gasto450, fijos: [{ concepto: 'Ascensor', monto: 900 }], motivo: 'Real.', version: cierre0.version,
    })
    expect(real.cuotas).toEqual(previa.cuotas)
    expect(previa.cuotas.find((c) => c.dpto === '101')?.falta).toBeGreaterThan(0)
  })

  it('una vista previa con error no deja nada a medias', async () => {
    await expect(
      corregirMes(MES, { extras: gasto450, recibo: { aguaM3: 0 }, motivo: '' }, { simular: true }),
    ).rejects.toMatchObject({ estado: 409 })
    expect(await prisma.gastoExtra.count({ where: { mes: MES } })).toBe(0)
  })
})
