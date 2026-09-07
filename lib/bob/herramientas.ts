/**
 * Lo que Bob puede llamar. `05-bob-agente.md` y Fase 8 §8.2.
 *
 * **Bob no ve los números directamente.** Llama a estas funciones y redacta con
 * lo que devuelven. La regla, del enunciado, es literal: *si no hay herramienta,
 * no hay número*. Y de aquí sale la guarda que lo hace cierto — toda cifra de la
 * respuesta tiene que existir en el resultado de alguna de estas llamadas.
 *
 * **Ninguna escribe.** No es una convención: el módulo entero solo importa
 * lectores (`lib/datos/*`), y hay un test que comprueba que aquí no aparece ni un
 * `prisma.…create`, `update` o `delete`.
 */

import { z } from 'zod'
import { DPTOS, DPTO_IDS } from '@/lib/calculo/constantes'
import { mesAnterior, nombreMes, comoMes } from '@/lib/calculo/mes'
import { fmt } from '@/lib/calculo/redondeo'
import { serieDelSaldo, mesesPublicados } from '@/lib/datos/meses'
import { pagosDe, resultadoDeMes } from '@/lib/datos/mes'
import { historialDeDpto } from '@/lib/datos/historial'
import type { DptoId, MesId } from '@/lib/calculo/tipos'
import type { Contexto, Herramienta } from './tipos'

/** Dos decimales, que es como se guarda y como se enseña todo lo que es plata. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

const zMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const zDpto = z.enum(DPTO_IDS as unknown as [string, ...string[]])

/** El mes del contexto si no se pide otro. Bob no adivina meses. */
function mesDe(argumentos: { mes?: string }, contexto: Contexto): MesId {
  const pedido = argumentos.mes
  // `as MesId`: la rama que devuelve `pedido` solo se toma si `zMes` lo validó;
  // `contexto.mes` ya es MesId. En los dos casos es un mes de verdad.
  return (pedido && zMes.safeParse(pedido).success ? pedido : contexto.mes) as MesId
}

/**
 * El departamento sobre el que se puede responder.
 *
 * Sin sesión de administración, **solo el propio**. Un vecino no le pregunta a
 * Bob cuánto debe el 501: eso es exactamente el lenguaje de cobranza que el
 * producto no tiene. El panel de administración sí ve los siete, porque quien
 * administra tiene que verlos para confirmar pagos.
 *
 * **Esto es una regla de tono, no una frontera de seguridad**, y conviene no
 * confundirlas. La app no autentica a los vecinos: no hay sesión de vecino en
 * ninguna parte, y `GET /api/dptos/501/historial` le responde a cualquiera. Lo
 * que esto decide es de qué habla Bob, no a qué datos se puede llegar. Si algún
 * día hace falta lo segundo, se resuelve autenticando al vecino, no aquí.
 */
function dptoDe(argumentos: { dpto?: string }, contexto: Contexto): DptoId | null {
  const pedido = argumentos.dpto
  if (!pedido) return contexto.dpto
  if (!zDpto.safeParse(pedido).success) return null
  if (contexto.esAdmin) return pedido as DptoId
  return pedido === contexto.dpto ? (pedido as DptoId) : null
}

const parametrosMes = {
  type: 'object',
  properties: { mes: { type: 'string', description: 'Mes en formato AAAA-MM. Si falta, el que se está mirando.' } },
} as const

const parametrosMesDpto = {
  type: 'object',
  properties: {
    mes: { type: 'string', description: 'Mes en formato AAAA-MM. Si falta, el que se está mirando.' },
    dpto: { type: 'string', description: 'Departamento. Si falta, el de quien pregunta.' },
  },
} as const

export const HERRAMIENTAS: Herramienta[] = [
  {
    nombre: 'calcularMes',
    descripcion: 'El mes entero: total, factura de agua, área común, las siete cuotas y si cuadra.',
    parametros: parametrosMes,
    async ejecutar(argumentos, contexto) {
      const mes = mesDe(argumentos as { mes?: string }, contexto)
      const r = await resultadoDeMes(mes)
      if (!r.valido) return { mes, valido: false, motivo: r.motivoInvalido }
      return {
        mes,
        nombreMes: nombreMes(mes),
        valido: true,
        totalMes: r.totalMes,
        facturaAgua: r.facturaAgua,
        aguaM3: r.rec.aguaM3,
        precioM3: r.precioM3,
        areaComunM3: r.comunReal,
        lavadoM3: r.lavado,
        repartoAjustado: r.ajustado,
        cuadra: r.cuadra,
      }
    },
  },
  {
    nombre: 'cuotaDe',
    descripcion: 'La cuota de un departamento en un mes, con su desglose de mantenimiento y agua.',
    parametros: parametrosMesDpto,
    async ejecutar(argumentos, contexto) {
      const mes = mesDe(argumentos as { mes?: string }, contexto)
      const dpto = dptoDe(argumentos as { dpto?: string }, contexto)
      if (!dpto) return { error: 'sin-departamento' }
      const r = await resultadoDeMes(mes)
      if (!r.valido) return { mes, dpto, valido: false, motivo: r.motivoInvalido }
      const c = r.cuotas[dpto]
      return {
        mes,
        nombreMes: nombreMes(mes),
        dpto,
        total: c.total,
        mantenimiento: c.mantenimiento,
        agua: c.agua,
        credito: c.credito,
        m3: c.m3,
        m3medidos: c.m3medidos,
        lavado: c.lavado,
        flat: DPTOS.find((d) => d.id === dpto)?.flat ?? null,
      }
    },
  },
  {
    nombre: 'consumoDe',
    descripcion: 'El consumo de agua de un departamento en los últimos meses, en m³.',
    parametros: parametrosMesDpto,
    async ejecutar(argumentos, contexto) {
      const dpto = dptoDe(argumentos as { dpto?: string }, contexto)
      if (!dpto) return { error: 'sin-departamento' }
      const h = await historialDeDpto(dpto)
      return {
        dpto,
        meses: h.filas.map((f) => ({
          mes: f.mes,
          nombreMes: nombreMes(comoMes(f.mes)),
          m3: f.m3,
          lavado: f.lavado,
        })),
        promedio: h.promedioM3,
      }
    },
  },
  {
    nombre: 'serieSaldo',
    descripcion: 'El saldo de la cuenta conjunta mes a mes: recibido, gastado y acumulado.',
    parametros: { type: 'object', properties: {} },
    async ejecutar() {
      const serie = await serieDelSaldo()
      return {
        meses: serie.map((f) => ({
          mes: f.mes,
          nombreMes: nombreMes(comoMes(f.mes)),
          recibido: f.recibido,
          gastado: f.gastado,
          saldo: f.saldo,
        })),
      }
    },
  },
  {
    nombre: 'estadoPagos',
    descripcion: 'Qué departamentos pagaron un mes, cuáles avisaron y cuáles no.',
    parametros: parametrosMes,
    async ejecutar(argumentos, contexto) {
      const mes = mesDe(argumentos as { mes?: string }, contexto)
      const pagos = await pagosDe(mes)
      const por = (estado: string | null) =>
        DPTO_IDS.filter((d) => (pagos[d]?.estado ?? null) === estado)
      return {
        mes,
        nombreMes: nombreMes(mes),
        alDia: por('confirmado'),
        enVerificacion: por('aviso'),
        sinRegistrar: por(null),
        cuantosAlDia: por('confirmado').length,
        deCuantos: DPTO_IDS.length,
      }
    },
  },
  {
    nombre: 'gastosDe',
    descripcion: 'Los conceptos de gasto de un mes con su monto.',
    parametros: parametrosMes,
    async ejecutar(argumentos, contexto) {
      const mes = mesDe(argumentos as { mes?: string }, contexto)
      const r = await resultadoDeMes(mes)
      if (!r.valido) return { mes, valido: false, motivo: r.motivoInvalido }
      return {
        mes,
        nombreMes: nombreMes(mes),
        total: r.totalMes,
        gastos: r.gastos.map((g) => ({
          concepto: g.concepto,
          monto: g.monto,
          anual: !!g.anual,
          porConfirmar: !!g.porConfirmar,
        })),
      }
    },
  },
  {
    nombre: 'comparaMeses',
    descripcion: 'Qué cambió entre dos meses: el total, la factura de agua y el consumo.',
    parametros: {
      type: 'object',
      properties: {
        mesA: { type: 'string', description: 'El mes más antiguo, AAAA-MM.' },
        mesB: { type: 'string', description: 'El más reciente. Si falta, el que se está mirando.' },
      },
    },
    async ejecutar(argumentos, contexto) {
      const a = argumentos as unknown as { mesA?: string; mesB?: string }
      const mesB = mesDe({ mes: a.mesB }, contexto)
      // `as MesId`: `a.mesA` solo se usa si `zMes` lo validó; `mesAnterior` ya da MesId.
      const mesA = (a.mesA && zMes.safeParse(a.mesA).success ? a.mesA : mesAnterior(mesB)) as MesId
      const [ra, rb] = await Promise.all([resultadoDeMes(mesA), resultadoDeMes(mesB)])
      if (!ra.valido || !rb.valido) {
        return { mesA, mesB, valido: false, motivo: ra.valido ? rb.motivoInvalido : ra.motivoInvalido }
      }
      return {
        mesA,
        mesB,
        nombreMesA: nombreMes(mesA),
        nombreMesB: nombreMes(mesB),
        totalA: ra.totalMes,
        totalB: rb.totalMes,
        diferenciaTotal: Math.round((rb.totalMes - ra.totalMes) * 100) / 100,
        aguaM3A: ra.rec.aguaM3,
        aguaM3B: rb.rec.aguaM3,
        facturaAguaA: ra.facturaAgua,
        facturaAguaB: rb.facturaAgua,
        /**
         * El reparto de la diferencia, calculado **aquí y no en la frase**.
         *
         * Bob explica de dónde viene el cambio, y para eso necesita la cifra
         * del agua y la del resto por separado. Si las restara al redactar,
         * serían números sin herramienta detrás y la guarda de `guardas.ts`
         * tiraría la respuesta entera, con razón: el sitio de una resta es el
         * motor, no el texto.
         */
        diferenciaAgua: redondear(rb.facturaAgua - ra.facturaAgua),
        diferenciaResto: redondear(
          rb.totalMes - ra.totalMes - (rb.facturaAgua - ra.facturaAgua),
        ),
      }
    },
  },
  {
    nombre: 'explicaLavado',
    descripcion: 'La reasignación de agua del lavado de vehículo: cuántos m³ y de dónde salen.',
    parametros: parametrosMes,
    async ejecutar(argumentos, contexto) {
      const mes = mesDe(argumentos as { mes?: string }, contexto)
      const r = await resultadoDeMes(mes)
      if (!r.valido) return { mes, valido: false, motivo: r.motivoInvalido }
      if (r.lavado <= 0) return { mes, nombreMes: nombreMes(mes), activo: false }
      return {
        mes,
        nombreMes: nombreMes(mes),
        activo: true,
        dpto: '401',
        m3: r.lavado,
        areaComunAntes: r.brutoComun,
        areaComunDespues: r.comunReal,
        /**
         * La frase que el diseño ya escribió, con las cifras del mes.
         * `05` §3 la enseña como ejemplo de respuesta buena.
         *
         * Las dos rayas largas del original son comas. Es la regla de forma
         * más rentable del criterio de redacción de la casa, y la única
         * puntuación de esta frase que delataba una máquina.
         */
        explicacion:
          `El lavado del 401 son ${fmt(r.lavado)} m³ al mes que salen del caño común. ` +
          `No se cobran por fuera de la factura: se restan del área común, que este mes queda en ` +
          `${fmt(r.comunReal)} m³, y se le suman al 401, así que el total del edificio sigue siendo ` +
          `exactamente lo que factura SEDAPAL.`,
      }
    },
  },
  {
    nombre: 'mesesDisponibles',
    descripcion: 'Qué meses están publicados y se pueden consultar.',
    parametros: { type: 'object', properties: {} },
    async ejecutar() {
      const meses = await mesesPublicados()
      return { meses, ultimo: meses[meses.length - 1] ?? null }
    },
  },
]

/** Busca una herramienta por nombre. `null` si no existe: Bob no inventa. */
export function herramienta(nombre: string): Herramienta | null {
  return HERRAMIENTAS.find((h) => h.nombre === nombre) ?? null
}
