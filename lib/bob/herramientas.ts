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
import { DPTOS, DPTO_IDS, LAVADO } from '@/lib/calculo/constantes'
import { mesAnterior, nombreMes, comoMes } from '@/lib/calculo/mes'
import { fmt } from '@/lib/calculo/redondeo'
import { serieDelSaldo, mesesPublicados, balanceDelDpto } from '@/lib/datos/meses'
import { pagosDe, resultadoDeMes } from '@/lib/datos/mes'
import { historialDeDpto } from '@/lib/datos/historial'
import { prisma } from '@/lib/datos/prisma'
import { CASOS, PROCEDIMIENTOS, procedimientoPara } from './procedimientos'
import type { DptoId, MesId } from '@/lib/calculo/tipos'
import { estadoCuota, type EstadoCuota } from '@/lib/estados'
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
    descripcion:
      'Qué departamentos pagaron un mes, cuáles avisaron y cuáles no, con la fecha de cada pago ' +
      'y la fecha de hoy. Con eso se puede decir cuántos días lleva algo sin registrarse.',
    parametros: parametrosMes,
    async ejecutar(argumentos, contexto) {
      const mes = mesDe(argumentos as { mes?: string }, contexto)
      const [pagos, r] = await Promise.all([pagosDe(mes), resultadoDeMes(mes)])
      /**
       * Se usa **el mismo `estadoCuota` que pinta la píldora**, y no el estado
       * crudo del pago.
       *
       * Si no, Bob decía «del 501 todavía no hay aviso» en junio y julio, con
       * la cuota condonada en cero: exactamente la frase que se quitó de la
       * pantalla por señalar al único que no debe nada. Una cosa es que la
       * interfaz lo arregle y otra que Bob lo siga diciendo.
       */
      const por = (cual: EstadoCuota) =>
        DPTO_IDS.filter(
          (d) => estadoCuota(pagos[d], r.valido ? r.cuotas[d].total : undefined) === cual,
        )
      const alDia = por('al-dia')
      const sinCobro = por('sin-cobro')
      return {
        mes,
        nombreMes: nombreMes(mes),
        alDia,
        enVerificacion: por('en-verificacion'),
        sinRegistrar: por('sin-registrar'),
        /** No deben nada porque su cuota quedó en cero. No es que falten. */
        sinNadaQuePagar: sinCobro,
        cuantosAlDia: alDia.length,
        /** Cuántos no tienen nada pendiente: pagaron, o no había qué pagar. */
        cuantosSinPendiente: alDia.length + sinCobro.length,
        deCuantos: DPTO_IDS.length,
        /**
         * Las fechas, y **hoy**.
         *
         * Sin esto, «¿hace cuántos días que no paga el 501?» no tenía respuesta
         * posible: la cuenta es una resta entre dos fechas y ninguna de las dos
         * estaba en ningún resultado. Bob no las inventa, las resta.
         */
        hoy: new Date().toISOString().slice(0, 10),
        fechas: DPTO_IDS.filter((d) => pagos[d]).map((d) => ({
          dpto: d,
          fecha: pagos[d]!.fecha,
          estado: pagos[d]!.estado,
          monto: pagos[d]!.monto,
        })),
      }
    },
  },
  {
    nombre: 'balanceDe',
    descripcion:
      'Lo que un departamento trae a favor o le falta, acumulado sobre los meses cerrados. ' +
      'Positivo es a favor, negativo es pendiente, cero es al día.',
    parametros: parametrosMesDpto,
    async ejecutar(argumentos, contexto) {
      const dpto = dptoDe(argumentos as { dpto?: string }, contexto)
      if (!dpto) return { error: 'sin-departamento' }
      const balance = await balanceDelDpto(dpto)
      return {
        dpto,
        balance: redondear(balance),
        aFavor: balance > 0,
        alDia: Math.abs(balance) < 0.01,
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
          /**
           * Quién paga un gasto puntual, y cómo se reparte.
           *
           * Sin esto Bob no podía explicar el portón: veía los S/ 300 y no que
           * los pagan seis, así que a la pregunta obvia —«¿por qué a mí me
           * tocó más?»— solo podía responder con el total.
           */
          extra: !!g.extra,
          ...(g.extra ? { loPagan: g.participantes ?? DPTO_IDS, reparto: g.reparto ?? 'porcentaje' } : {}),
        })),
      }
    },
  },
  {
    nombre: 'historialPagos',
    descripcion:
      'Los meses cerrados de un departamento con su cuota, si está pagado y en qué fecha. ' +
      'Sirve para saber desde cuándo no se registra un pago.',
    parametros: parametrosMesDpto,
    async ejecutar(argumentos, contexto) {
      const dpto = dptoDe(argumentos as { dpto?: string }, contexto)
      if (!dpto) return { error: 'sin-departamento' }
      const h = await historialDeDpto(dpto)
      const pagados = h.filas.filter((f) => f.estado === 'confirmado' && f.fecha)
      return {
        dpto,
        hoy: new Date().toISOString().slice(0, 10),
        meses: h.filas.map((f) => ({
          mes: f.mes,
          cuota: f.cuota,
          estado: f.estado,
          fecha: f.fecha,
        })),
        // La más reciente, que es de donde sale el «hace N días».
        ultimoPago: pagados.length ? pagados[pagados.length - 1]!.fecha : null,
        mesesAlDia: h.mesesAlDia,
        mesesEnVerificacion: h.mesesEnVerificacion,
        totalPagado: h.totalPagado,
      }
    },
  },
  {
    nombre: 'datosDeLaCuenta',
    descripcion:
      'A qué cuenta se deposita: banco, número, CCI, a nombre de quién, y qué día vence la cuota.',
    parametros: { type: 'object', properties: {} },
    async ejecutar() {
      const c = await prisma.configuracionEdificio.findUnique({ where: { id: 1 } })
      if (!c) return { hayCuenta: false }
      return {
        hayCuenta: true,
        banco: c.bancoNombre,
        cuenta: c.bancoCuenta,
        cci: c.bancoCci,
        titular: c.bancoTitular,
        diaVencimiento: c.diaVencimiento,
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
      /**
       * Con el lavado apagado **también** se dice de quién es.
       *
       * Sin este `dpto`, la respuesta correcta —«cuando está activo, esos m³ se
       * le cargan al 401»— llevaba un 401 que no salía de ninguna herramienta,
       * y la guarda de números la habría descartado entera si la hubiera
       * escrito el modelo. El catálogo la decía igual porque a él no se le
       * aplica la guarda: o sea, la misma frase pasaba o no según quién la
       * escribiera.
       */
      if (r.lavado <= 0)
        return { mes, nombreMes: nombreMes(mes), activo: false, dpto: LAVADO.dpto }
      return {
        mes,
        nombreMes: nombreMes(mes),
        activo: true,
        dpto: LAVADO.dpto,
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
    nombre: 'quienVive',
    descripcion:
      'Los siete departamentos del edificio: quién vive en cada uno, su piso y su porcentaje de la escritura.',
    parametros: {
      type: 'object',
      properties: { dpto: { type: 'string', description: 'Si preguntan por uno en concreto.' } },
    },
    async ejecutar(argumentos: { dpto?: string }) {
      /**
       * Los nombres salen de la **base**, no de `DPTOS`.
       *
       * Es lo mismo mientras nadie cambie de dueño, y deja de serlo el día que
       * alguien se muda: la constante es la escritura, la base es quién vive
       * hoy. Bob tiene que decir quién vive hoy. Los porcentajes sí son de la
       * escritura y por eso se toman de la constante, que es donde el test
       * candado los vigila.
       */
      const filas = await prisma.departamento.findMany({ orderBy: { id: 'asc' } })
      const porId = new Map(filas.map((f) => [f.id, f.nombre]))
      const todos = DPTOS.map((d) => ({
        dpto: d.id,
        quienVive: porId.get(d.id) ?? d.nombre,
        piso: d.piso,
        porcentaje: d.flat,
      }))
      // Si preguntaron por uno en concreto, se dice cuál es. Quién vive dónde
      // es público entre los siete, así que esto no pasa por `dptoDe`.
      const pedido = typeof argumentos.dpto === 'string' ? argumentos.dpto : null
      const uno = pedido ? (todos.find((x) => x.dpto === pedido) ?? null) : null
      return { dptos: todos, preguntadoPor: uno }
    },
  },
  {
    nombre: 'comoSeHace',
    descripcion:
      'El procedimiento para un caso concreto de la app: gasto extra, gasto que no paga alguien, ' +
      'pago adelantado, pago parcial, condonar, corregir un mes publicado, cambiar un gasto fijo, ' +
      'concepto nuevo, lavado de vehículo, cambio de dueño, publicar, o un mes que no cuadra. ' +
      'Llámala siempre que pregunten cómo se registra o cómo se hace algo.',
    parametros: {
      type: 'object',
      properties: {
        caso: {
          type: 'string',
          description: `Uno de: ${CASOS.join(', ')}. También vale la pregunta tal cual la escribieron.`,
        },
      },
      required: ['caso'],
    },
    async ejecutar(argumentos: { caso?: string }) {
      const pedido = typeof argumentos.caso === 'string' ? argumentos.caso : ''
      const p = procedimientoPara(pedido)
      /**
       * Sin receta no se improvisa una: se devuelve la lista de las que hay.
       *
       * Inventar un procedimiento es peor que no tenerlo. Quien administra lo
       * seguiría, y el error terminaría en la cuota de alguien.
       */
      if (!p) {
        return {
          encontrado: false,
          casos: PROCEDIMIENTOS.map((x) => ({ caso: x.caso, queEs: x.queEs })),
        }
      }
      return {
        encontrado: true,
        caso: p.caso,
        queEs: p.queEs,
        donde: p.donde,
        pasos: p.pasos,
        ...(p.ojoCon ? { ojoCon: p.ojoCon } : {}),
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
