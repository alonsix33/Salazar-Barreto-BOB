/**
 * Carga inicial de la base.
 *
 * **Está marcado qué es real y qué es de ejemplo.** Lo de ejemplo hay que
 * reemplazarlo con los recibos verdaderos antes de que la app sirva de algo;
 * la lista de lo que hace falta está en `docs/AUDITORIA-FINAL.md`.
 *
 *   npm run db:seed
 *
 * Es idempotente: se puede volver a correr sobre una base ya cargada.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import {
  DEPARTAMENTOS,
  FIJOS,
  LECTURAS,
  MESES_PUBLICADOS,
  MESES_SEMILLA,
  PAGOS,
  REASIGNACION_LAVADO,
  RECIBOS,
} from '../lib/semilla'
import { calcularMes } from '../lib/calculo/calcularMes'
import { mesAnterior, nombreMes } from '../lib/calculo/mes'
import { fmt, round2 } from '../lib/calculo/redondeo'
import type { DptoId, EntradasMes, MesId } from '../lib/calculo/tipos'

const prisma = new PrismaClient()

/** Convierte `'9 ene'` del prototipo a una fecha del año de la semilla. */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
function fechaDe(mes: MesId, texto: string): Date {
  const [dia, corto] = texto.split(' ')
  const anio = Number(mes.split('-')[0])
  const indice = MESES_CORTOS.indexOf((corto ?? '').toLowerCase())
  return new Date(Date.UTC(anio, indice === -1 ? Number(mes.split('-')[1]) - 1 : indice, Number(dia) || 1))
}

const dec = (n: number) => new Prisma.Decimal(n.toFixed(2))

async function main() {
  console.log('Cargando la semilla…')

  // ── REAL — de la escritura del edificio. No modificar sin documento.
  for (const d of DEPARTAMENTOS) {
    await prisma.departamento.upsert({
      where: { id: d.id },
      create: { id: d.id, nombre: d.nombre, flat: new Prisma.Decimal(d.flat.toFixed(2)), piso: d.piso },
      update: { nombre: d.nombre, flat: new Prisma.Decimal(d.flat.toFixed(2)), piso: d.piso },
    })
  }
  const suma = DEPARTAMENTOS.reduce((s, d) => s + d.flat, 0)
  if (suma !== 100) throw new Error(`Los flats suman ${suma}, no 100.`)
  console.log(`  ${DEPARTAMENTOS.length} departamentos · flats suman ${suma.toFixed(2)}`)

  // ── REAL — los conceptos y sus montos habituales, vigentes desde el primer mes.
  const primerMes = MESES_SEMILLA[0]!
  for (const [i, g] of FIJOS.entries()) {
    await prisma.gastoFijo.upsert({
      where: { concepto_vigenteDesde: { concepto: g.concepto, vigenteDesde: primerMes } },
      create: {
        concepto: g.concepto,
        monto: g.monto === null ? null : dec(g.monto),
        anual: g.anual ?? false,
        vigenteDesde: primerMes,
        orden: i,
      },
      update: { monto: g.monto === null ? null : dec(g.monto), anual: g.anual ?? false, orden: i },
    })
  }
  console.log(`  ${FIJOS.length} gastos fijos · el pozo a tierra queda en null, que es "por confirmar"`)

  // ── REAL — el lavado del 401, acordado entre los vecinos.
  const reasignacion = await prisma.reasignacionAgua.upsert({
    where: { dptoId_concepto: { dptoId: REASIGNACION_LAVADO.dpto, concepto: REASIGNACION_LAVADO.concepto } },
    create: {
      dptoId: REASIGNACION_LAVADO.dpto,
      concepto: REASIGNACION_LAVADO.concepto,
      m3: dec(REASIGNACION_LAVADO.m3),
      desde: REASIGNACION_LAVADO.desde,
    },
    update: { m3: dec(REASIGNACION_LAVADO.m3), desde: REASIGNACION_LAVADO.desde },
  })
  // Activa en todos los meses desde el que aplica.
  //
  // Los meses que la semilla deja **publicados** llevan además sus m³ congelados,
  // igual que si se hubieran publicado desde la app: un mes cerrado no se mueve
  // porque alguien cambie después el consumo del lavado. El mes en curso los
  // deja en `null`, que significa "sigue el valor actual".
  const ultimoSemilla = MESES_SEMILLA[MESES_SEMILLA.length - 1]
  for (const mes of MESES_SEMILLA.filter((m) => m >= REASIGNACION_LAVADO.desde)) {
    const congelado = mes === ultimoSemilla ? null : dec(REASIGNACION_LAVADO.m3)
    await prisma.reasignacionActivaEnMes.upsert({
      where: { reasignacionId_mes: { reasignacionId: reasignacion.id, mes } },
      create: { reasignacionId: reasignacion.id, mes, activa: true, m3: congelado },
      update: { activa: true, m3: congelado },
    })
  }

  // ── EJEMPLO — lecturas realistas pero inventadas.
  //
  // **El mes en curso se carga vacío.** Sus lecturas y su recibo son justo lo
  // que el administrador va a teclear en el cierre: dejarlos precargados haría
  // que el paso 1 abriera en "7 / 7" y el cierre no tendría nada que hacer.
  // `lib/semilla.ts` sí los trae, para poder usarlos en los tests.
  const enCursoSemilla = MESES_SEMILLA[MESES_SEMILLA.length - 1]!
  let nLecturas = 0
  for (const [mes, lecturas] of Object.entries(LECTURAS)) {
    if (mes === enCursoSemilla) continue
    for (const [dptoId, valor] of Object.entries(lecturas)) {
      if (valor === undefined) continue
      await prisma.lectura.upsert({
        where: { mes_dptoId: { mes, dptoId } },
        create: { mes, dptoId, valor: new Prisma.Decimal(valor.toFixed(3)), registradoPor: 'semilla' },
        update: { valor: new Prisma.Decimal(valor.toFixed(3)) },
      })
      nLecturas++
    }
  }
  console.log(`  ${nLecturas} lecturas · EJEMPLO, hay que reemplazarlas`)

  // ── EJEMPLO — recibos realistas pero inventados. El del mes en curso, no:
  // es el papel que el administrador tiene delante en los pasos 2 y 3.
  for (const [mes, r] of Object.entries(RECIBOS)) {
    if (mes === enCursoSemilla) continue
    await prisma.recibo.upsert({
      where: { mes },
      create: {
        mes,
        aguaM3: r.aguaM3,
        aguaMonto: dec(r.aguaMonto),
        descuento: r.descuento == null ? null : dec(r.descuento),
        luz: dec(r.luz),
        registradoPor: 'semilla',
      },
      update: {
        aguaM3: r.aguaM3,
        aguaMonto: dec(r.aguaMonto),
        descuento: r.descuento == null ? null : dec(r.descuento),
        luz: dec(r.luz),
      },
    })
  }
  const nRecibos = Object.keys(RECIBOS).filter((m) => m !== enCursoSemilla).length
  console.log(`  ${nRecibos} recibos · EJEMPLO, hay que reemplazarlos`)

  // ── EJEMPLO — pagos realistas pero inventados.
  let nPagos = 0
  for (const [mes, pagos] of Object.entries(PAGOS)) {
    for (const [dptoId, p] of Object.entries(pagos)) {
      if (!p) continue
      await prisma.pago.upsert({
        where: { mes_dptoId: { mes, dptoId } },
        create: {
          mes,
          dptoId,
          estado: p.estado,
          fecha: fechaDe(mes, p.fecha),
          operacion: p.op ?? null,
          texto: p.texto ?? null,
          confirmadoPor: p.estado === 'confirmado' ? 'semilla' : null,
        },
        update: { estado: p.estado, operacion: p.op ?? null, texto: p.texto ?? null },
      })
      nPagos++
    }
  }
  console.log(`  ${nPagos} pagos · EJEMPLO, hay que reemplazarlos`)

  // ── Los cierres de los meses publicados, con su instantánea.
  const entradasDe = (mes: MesId): EntradasMes => ({
    mesId: mes,
    recibo: RECIBOS[mes] ?? null,
    lecturas: LECTURAS[mes] ?? {},
    lecturasAnteriores: LECTURAS[mesAnterior(mes)] ?? {},
    fijos: FIJOS,
    extras: [],
    lavadoM3: REASIGNACION_LAVADO.m3,
  })

  for (const mes of MESES_PUBLICADOS) {
    const resultado = calcularMes(entradasDe(mes))
    if (!resultado.valido) throw new Error(`La semilla no puede calcular ${mes}: ${resultado.motivoInvalido}`)
    await prisma.cierre.upsert({
      where: { mes },
      create: {
        mes,
        publicado: true,
        publicadoPor: 'semilla',
        publicadoEn: new Date(Date.UTC(Number(mes.split('-')[0]), Number(mes.split('-')[1]), 1)),
        paso: 7,
        instantanea: JSON.parse(JSON.stringify(resultado)) as Prisma.InputJsonValue,
      },
      update: {},
    })
  }
  // El mes en curso: existe, sin publicar, en el paso 0.
  const enCurso = enCursoSemilla
  if (!MESES_PUBLICADOS.includes(enCurso)) {
    await prisma.cierre.upsert({
      where: { mes: enCurso },
      create: { mes: enCurso, publicado: false, paso: 0 },
      update: {},
    })
  }
  console.log(`  ${MESES_PUBLICADOS.length} meses publicados · ${enCurso} en curso, sin publicar`)

  // ── El saldo inicial.
  //
  // EJEMPLO — derivado para que la serie coincida con la del prototipo, que
  // ancla el cierre de junio en S/ 4 182.40. **Hay que reemplazarlo con el saldo
  // real de la cuenta antes del primer mes cargado**: es el único dato que la
  // app no puede deducir de los recibos.
  const SALDO_FINAL_PROTOTIPO = 4182.4
  let totalDelta = 0
  for (const mes of MESES_PUBLICADOS) {
    const c = calcularMes(entradasDe(mes))
    const pagos = PAGOS[mes] ?? {}
    const recibido = round2(
      DEPARTAMENTOS.reduce((s, d) => {
        const p = pagos[d.id as DptoId]
        return s + (p && p.estado === 'confirmado' ? c.cuotas[d.id].total : 0)
      }, 0),
    )
    totalDelta += round2(recibido - c.totalMes)
  }
  const saldoInicial = round2(SALDO_FINAL_PROTOTIPO - totalDelta)

  await prisma.configuracionEdificio.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      saldoInicial: dec(saldoInicial),
      mesInicial: MESES_PUBLICADOS[0]!,
      // EJEMPLO — datos de la cuenta. Reemplazar con los verdaderos.
      bancoNombre: 'BCP',
      bancoCuenta: '191-0000000-0-00',
      bancoCci: '00219100000000000000',
      bancoTitular: 'Junta de propietarios Jr. Enrique Salazar Barreto',
      diaVencimiento: 10,
    },
    update: {},
  })
  console.log(`  saldo inicial S/ ${saldoInicial.toFixed(2)} desde ${MESES_PUBLICADOS[0]} · EJEMPLO, hay que reemplazarlo`)

  // ── Un aviso por cada mes publicado, que es lo que los vecinos habrían visto.
  for (const mes of MESES_PUBLICADOS) {
    const c = calcularMes(entradasDe(mes))
    const existe = await prisma.aviso.findFirst({ where: { tipo: 'mes_publicado', mes } })
    if (!existe) {
      await prisma.aviso.create({
        data: {
          tipo: 'mes_publicado',
          // Los mismos textos que genera `publicarMes`: si la semilla y el
          // servicio escribieran distinto, la pantalla mezclaría dos voces.
          titulo: `Ya está el cierre de ${nombreMes(mes)}`,
          detalle: `El mes cerró en S/ ${fmt(c.totalMes)}, repartido entre los siete.`,
          mes,
          // Con la fecha en que se habría publicado, no la de la carga: si no,
          // los seis meses caen todos bajo "Hoy" y el grupo pierde el sentido.
          creadoEn: new Date(Date.UTC(Number(mes.split('-')[0]), Number(mes.split('-')[1]), 1)),
        },
      })
    }
  }

  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
