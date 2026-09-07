/**
 * El motor leyendo de la base ↔ el motor leyendo de la semilla.
 *
 * Fase 3, punto 2 del verificador: para los ocho meses de la semilla, el
 * `ResultadoMes` que sale de la base tiene que ser **idéntico** al que sale del
 * motor local con los mismos datos.
 *
 * Si esto falla, la traducción `Decimal → number` está perdiendo precisión, o el
 * orden de los gastos fijos que devuelve la base no es el del motor, o el lavado
 * no se está leyendo bien. Los tres son bugs caros y silenciosos.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calcularMes } from '@/lib/calculo/calcularMes'
import { mesAnterior } from '@/lib/calculo/mes'
import { DPTO_IDS } from '@/lib/calculo/constantes'
import { entradasDeMes, resultadoDeMes } from '@/lib/datos/mes'
import { serieDelSaldo } from '@/lib/datos/meses'
import { FIJOS, LECTURAS, MESES_SEMILLA, RECIBOS, REASIGNACION_LAVADO } from '@/lib/semilla'
import type { EntradasMes, MesId } from '@/lib/calculo/tipos'
import { prisma, resembrar } from './entorno'

const desdeLaSemilla = (mes: MesId): EntradasMes => ({
  mesId: mes,
  recibo: RECIBOS[mes] ?? null,
  lecturas: LECTURAS[mes] ?? {},
  lecturasAnteriores: LECTURAS[mesAnterior(mes)] ?? {},
  fijos: FIJOS,
  extras: [],
  lavadoM3: REASIGNACION_LAVADO.m3,
})

beforeAll(async () => {
  await resembrar()
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

/**
 * El mes en curso se carga **vacío** a propósito: sus lecturas y su recibo son
 * lo que el administrador va a teclear en el cierre. Los que se comparan son
 * los meses ya cerrados.
 */
const MESES_CERRADOS = MESES_SEMILLA.slice(0, -1)
const EN_CURSO = MESES_SEMILLA[MESES_SEMILLA.length - 1]!

describe('los meses cerrados de la semilla, desde la base', () => {
  for (const mes of MESES_CERRADOS) {
    it(`${mes} da lo mismo desde la base que desde el motor local`, async () => {
      const deLaBase = await resultadoDeMes(mes)
      const local = calcularMes(desdeLaSemilla(mes))
      expect(deLaBase).toEqual(local)
    })
  }

  it(`${EN_CURSO} está vacío: es el que se va a cerrar`, async () => {
    const r = await resultadoDeMes(EN_CURSO)
    expect(r.valido).toBe(false)
    expect(r.motivoInvalido).toContain('recibo')
    // Y no revienta ni devuelve NaN: devuelve un resultado marcado como inválido.
    expect(Number.isFinite(r.totalMes)).toBe(true)
  })

  it('las entradas leídas de la base son las de la semilla', async () => {
    const entradas = await entradasDeMes('2026-06')
    const local = desdeLaSemilla('2026-06')
    // La base devuelve `descuento: null` explícito y la semilla lo omite. El
    // motor normaliza los dos a `null`, y por eso los ocho meses de arriba dan
    // idénticos; aquí se comparan normalizados para no fijar esa diferencia.
    expect({ ...entradas.recibo, descuento: entradas.recibo?.descuento ?? null })
      .toEqual({ ...local.recibo, descuento: local.recibo?.descuento ?? null })
    expect(entradas.lecturas).toEqual(local.lecturas)
    expect(entradas.lecturasAnteriores).toEqual(local.lecturasAnteriores)
    expect(entradas.lavadoM3).toBe(local.lavadoM3)
    expect(entradas.fijos.map((g) => g.concepto)).toEqual(local.fijos.map((g) => g.concepto))
    expect(entradas.fijos.map((g) => g.monto)).toEqual(local.fijos.map((g) => g.monto))
  })

  it('la traducción Decimal → number no pierde ni un céntimo', async () => {
    const r = await resultadoDeMes('2026-06')
    expect(r.valido).toBe(true)
    expect(r.totalMes).toBe(3317.98)
    expect(r.cuotas['401'].total).toBe(384.33)
    // 675.73 y no 675.43: el flat del 502 se corrigió a la escritura
    // (20.22 → 20.23), lo que mueve su mantenimiento de 605.18 a 605.48.
    expect(r.cuotas['502'].total).toBe(675.73)
    expect(r.facturaAgua).toBe(325)
    expect(r.comunReal).toBe(1.62)
  })

  it('el pozo a tierra llega como null, no como cero', async () => {
    const r = await resultadoDeMes('2026-06')
    const pozo = r.gastos.find((g) => g.concepto === 'Pozo a tierra')
    expect(pozo?.monto).toBeNull()
    expect(pozo?.porConfirmar).toBe(true)
  })
})

describe('el saldo acumula hacia adelante', () => {
  it('la serie sale del saldo inicial guardado, no derivada hacia atrás', async () => {
    const config = await prisma.configuracionEdificio.findUnique({ where: { id: 1 } })
    expect(config).not.toBeNull()
    const serie = await serieDelSaldo()
    expect(serie.length).toBeGreaterThan(0)

    // El primer saldo es el inicial más el delta del primer mes.
    const inicial = Number(String(config!.saldoInicial))
    expect(serie[0]!.saldo).toBe(Math.round((inicial + serie[0]!.delta) * 100) / 100)

    // Y cada uno es el anterior más su delta: la serie no se ancla al final.
    for (let i = 1; i < serie.length; i++) {
      expect(serie[i]!.saldo).toBe(Math.round((serie[i - 1]!.saldo + serie[i]!.delta) * 100) / 100)
    }
  })

  it('solo cuentan los pagos confirmados', async () => {
    // Junio tiene el 201 en `aviso` y el 501 sin registrar.
    const serie = await serieDelSaldo()
    const junio = serie.find((f) => f.mes === '2026-06')!
    const r = await resultadoDeMes('2026-06')
    const confirmados = DPTO_IDS.filter((d) => !['201', '501'].includes(d))
    const esperado = Math.round(confirmados.reduce((s, d) => s + r.cuotas[d].total, 0) * 100) / 100
    expect(junio.recibido).toBe(esperado)
  })
})
