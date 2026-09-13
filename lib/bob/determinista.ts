/**
 * El catálogo de intenciones. `05-bob-agente.md` §3 y §5.
 *
 * Con `BOB_MODO=determinista` esto es Bob entero: **sin clave, sin coste y sin
 * red**. Y con `BOB_MODO=deepseek` sigue siendo el suelo: cuando el modelo
 * tarda, falla o inventa una cifra, la respuesta se descarta y se cae aquí, sin
 * que el vecino vea un error.
 *
 * Las reglas de voz de `05` §3 valen igual aquí que allí, y aquí se cumplen por
 * construcción:
 *
 *  - **Dos líneas.** Si hace falta más, el momento está mal diseñado.
 *  - **Siempre con el dato.** No «tu consumo subió» sino «subiste de 6.20 a 8.42».
 *  - **Con dónde verificarlo.** Cada respuesta lleva a la pantalla que la
 *    demuestra: es el «nada de confía en mí» aplicado a Bob.
 *  - **Sin hablar de sí mismo.** Nunca «como asistente, no puedo…». Dice qué sí
 *    puede y quién sí puede lo otro.
 *  - **Reporta lo bueno también.** No solo pendientes.
 *
 * Todas las cifras salen de las herramientas. Ninguna se escribe aquí.
 */

import { DPTO_IDS } from '@/lib/calculo/constantes'
import { fmt } from '@/lib/calculo/redondeo'
import { capitalizar, enumerar } from '@/lib/formato'
import { herramienta } from './herramientas'
import { procedimientoPara, suenaAComo } from './procedimientos'
import type { Contexto, Llamada, Respuesta } from './tipos'

/** Ejecuta una herramienta y deja constancia, que es de donde sale la guarda. */
async function llamar(
  nombre: string,
  argumentos: Record<string, unknown>,
  contexto: Contexto,
  llamadas: Llamada[],
): Promise<Record<string, unknown>> {
  const h = herramienta(nombre)
  if (!h) throw new Error(`No existe la herramienta ${nombre}`)
  const t = Date.now()
  // Cada herramienta devuelve su propia forma; aquí se leen campos por nombre,
  // así que se trata como diccionario. La guarda de números valida las cifras aparte.
  const resultado = (await h.ejecutar(argumentos, contexto)) as Record<string, unknown>
  llamadas.push({ herramienta: nombre, argumentos, resultado, ms: Date.now() - t })
  return resultado
}

/** Las palabras que disparan cada intención, sin tildes y en minúscula. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

const INTENCIONES = [
  { id: 'cuota', palabras: ['cuanto debo', 'cuanto pago', 'mi cuota', 'cuanto es', 'cuanto me toca'] },
  { id: 'agua', palabras: ['agua', 'consumo', 'm3', 'metros cubicos', 'subio el agua', 'sedapal'] },
  { id: 'pagos', palabras: ['quien falta', 'quien no ha pagado', 'quien pago', 'pagos', 'al dia'] },
  { id: 'lavado', palabras: ['lavado', 'carro', 'vehiculo', 'auto'] },
  { id: 'gastos', palabras: ['en que se gasto', 'gastos', 'en que se fue', 'guardiania', 'ascensor'] },
  { id: 'saldo', palabras: ['saldo', 'cuenta', 'fondo', 'cuanto hay'] },
  { id: 'comparar', palabras: ['mas que', 'menos que', 'comparado', 'mes pasado', 'subio', 'bajo'] },
  { id: 'banco', palabras: ['deposito', 'transferencia', 'banco', 'viste mi pago', 'ya pague'] },
  { id: 'escribir', palabras: ['confirma', 'cambia', 'publica', 'registra', 'corrige', 'modifica', 'borra'] },
  { id: 'quienes', palabras: ['quien vive', 'quienes viven', 'quien es el', 'duenos', 'propietarios', 'vecinos', 'los nombres'] },
] as const

type Intencion = (typeof INTENCIONES)[number]["id"] | "como" | "nada"

/** Qué está preguntando. La primera que encaja gana. */
export function intencionDe(texto: string): Intencion {
  const t = normalizar(texto)
  /**
   * Antes que nada, «cómo se hace esto».
   *
   * Hacen falta **las dos señales a la vez**: que suene a trámite y que exista
   * un procedimiento para lo que menciona. Una sola no basta, y las dos solas
   * se equivocan en direcciones opuestas: «¿cuánto subió el agua?» suena a
   * pregunta pero no es un trámite, y «se malogró la bomba» menciona un caso
   * pero no pide instrucciones.
   *
   * Va **delante de `escribir`**: «cómo registro un pago adelantado» es una
   * pregunta de procedimiento, no un pedido de que Bob lo registre, y la
   * palabra «registro» está en las dos listas. Sin esto, la pregunta más útil
   * que puede hacer quien administra se respondía con «eso lo cambia quien
   * administra», que es cierto e inútil. Lo mismo con «no me deja publicar»,
   * que caía en `escribir` por la palabra «publicar».
   */
  if (suenaAComo(t) && procedimientoPara(t)) return 'como'

  // Después, las dos prohibiciones: si alguien pide que confirme un pago
  // hablando del banco, la respuesta correcta es la del banco.
  for (const id of ['escribir', 'banco'] as const) {
    const i = INTENCIONES.find((x) => x.id === id)!
    if (i.palabras.some((p) => t.includes(p))) return id
  }
  for (const i of INTENCIONES) {
    if (i.palabras.some((p) => t.includes(p))) return i.id
  }
  return 'nada'
}

/** Responde con el catálogo. Nunca falla: es el suelo de todo lo demás. */
export async function responderDeterminista(
  texto: string,
  contexto: Contexto,
  llamadasPrevias: Llamada[] = [],
): Promise<Omit<Respuesta, 'modo' | 'motivoCaida'>> {
  const llamadas = [...llamadasPrevias]
  const r = await redactar(texto, contexto, llamadas)
  return { ...r, llamadas }
}

/** Lo que se dice, sin el registro. Cada rama devuelve texto y adónde lleva. */
async function redactar(
  texto: string,
  contexto: Contexto,
  llamadas: Llamada[],
): Promise<{ texto: string; lleva: Respuesta['lleva'] }> {
  switch (intencionDe(texto)) {
    /**
     * Cómo se hace algo en la app. El caso atípico del mes.
     *
     * La receta **no se escribe aquí**: se pide a la herramienta `comoSeHace`,
     * igual que una cifra. No es ceremonia. La guarda de números descarta la
     * respuesta entera si aparece un número sin herramienta detrás, y una
     * instrucción está llena de ellos: «paso 5», «el 502», «los siete». Con la
     * receta dentro de una llamada, esos números quedan respaldados, y de paso
     * el procedimiento que se le dio a alguien queda en `consulta_bob`.
     */
    case 'como': {
      const p = await llamar('comoSeHace', { caso: texto }, contexto, llamadas)
      if (p.encontrado === false) {
        /**
         * Sin receta, se dice qué recetas hay, **por su nombre y no por su
         * descripción**. Enumerar cuatro descripciones enteras daba una segunda
         * frase de cuarenta palabras que se leía como un formulario, y encima
         * mezclaba comas suyas con las comas de la enumeración.
         */
        const casos = p.casos as { caso: string; queEs: string }[]
        const nombres = casos.map((c) => c.caso.replace(/-/g, ' '))
        return {
          texto: `De eso no tengo el procedimiento. Lo que sí: ${enumerar(nombres)}.`,
          lleva: null,
        }
      }
      /**
       * Dos frases: qué es y dónde se hace. Los pasos quedan en el resultado de
       * la herramienta, que es lo que ve el modelo cuando redacta la versión
       * larga, y aquí no caben: `05` §3 dice dos, y dos es dos.
       */
      return { texto: `${String(p.queEs)} ${String(p.donde)}`, lleva: null }
    }

    /**
     * Quién vive en cada departamento.
     *
     * Los nombres son públicos entre los siete —la transparencia es el punto
     * del producto— y no llevan ningún dato de contacto. Lo que **no** se dice
     * aquí es cuánto debe cada uno: eso sigue siendo del administrador, y esta
     * rama no llama a `estadoPagos` a propósito.
     */
    case 'quienes': {
      /**
       * Si la pregunta nombra un departamento, se responde por **ese**.
       *
       * «¿Quién vive en el 202?» respondía con los datos del 401, que es el de
       * quien preguntaba. La pregunta traía la respuesta y Bob la ignoraba.
       */
      const mencionado = DPTO_IDS.find((id) => texto.includes(id)) ?? undefined
      const d = await llamar('quienVive', mencionado ? { dpto: mencionado } : {}, contexto, llamadas)
      const dptos = d.dptos as { dpto: string; quienVive: string; porcentaje: number }[]
      const uno =
        (d.preguntadoPor as (typeof dptos)[number] | null) ??
        (contexto.dpto ? (dptos.find((x) => x.dpto === contexto.dpto) ?? null) : null)
      const lista = enumerar(dptos.map((x) => `${x.dpto} ${x.quienVive}`))
      if (uno) {
        return {
          texto: `En el ${uno.dpto} están ${uno.quienVive}, con ${fmt(uno.porcentaje)} % de la escritura. Los siete: ${lista}.`,
          lleva: null,
        }
      }
      return { texto: `Los siete departamentos son: ${lista}.`, lleva: null }
    }

    /**
     * Lo que Bob **no** puede hacer. `05` §2, que es un contrato.
     *
     * Arranca por **quién sí puede y dónde**, no por «yo solo leo». La versión
     * anterior empezaba hablando de sí mismo, que es justo lo que `05` §3
     * prohíbe, y encima dejaba al vecino sin saber qué hacer después. Ahora la
     * primera frase resuelve el trámite y la segunda ofrece lo que sí hay.
     */
    case 'escribir':
      return {
        texto:
          'Eso lo cambia quien administra, desde Avisos → Administración, y queda registrado con la fecha. ' +
          'Acá lo que hay es tu cuota del mes, tu consumo de agua y en qué se fue la plata.',
        lleva: null,
      }

    /**
     * El banco. La prohibición más importante de `05` §2.
     *
     * Bob **no tiene acceso a la cuenta bancaria**: no puede ver depósitos, ni
     * decir que vio uno, ni rellenar un monto desde el estado de cuenta.
     *
     * El orden de las dos frases importa. Antes empezaba por la negativa —«no
     * tengo acceso», «no puedo ver»— y el dato útil llegaba al final, si es que
     * llegaba. Ahora primero va lo que sí se sabe, y después de dónde no sale.
     * El límite se dice una vez y sin disculparse.
     */
    case 'banco': {
      const pagos = await llamar('estadoPagos', {}, contexto, llamadas)
      const mio = contexto.dpto
      const mes = String(pagos.nombreMes)
      const noVeoElBanco = 'Los depósitos no los veo yo: los revisa quien administra contra el estado de cuenta.'
      if (!mio) {
        return { texto: `${capitalizar(mes)} va con ${String(pagos.cuantosAlDia)} de ${String(pagos.deCuantos)} pagos confirmados. ${noVeoElBanco}`, lleva: null }
      }
      if ((pagos.alDia as string[]).includes(mio)) {
        return { texto: `Tu pago de ${mes} ya está confirmado. ${noVeoElBanco}`, lleva: { hoja: 'pagos', etiqueta: 'Ver mis pagos' } }
      }
      if ((pagos.enVerificacion as string[]).includes(mio)) {
        return { texto: `Tu aviso de ${mes} ya está puesto y queda en verificación. ${noVeoElBanco}`, lleva: { hoja: 'pagos', etiqueta: 'Ver mis pagos' } }
      }
      return {
        texto: `De ${mes} todavía no hay nada registrado a tu nombre. Cuando transfieras, avisa desde Cómo pagar y quien administra lo confirma contra el estado de cuenta.`,
        lleva: { hoja: 'pagar', etiqueta: 'Ver cómo pagar' },
      }
    }

    /**
     * La cuota. La pregunta que más se hace.
     *
     * Lleva el estado del pago pegado, que es lo que se va a preguntar
     * después. Proactivo quiere decir eso: contestar la segunda pregunta sin
     * que haya que escribirla.
     */
    case 'cuota': {
      if (!contexto.dpto) {
        return { texto: 'Todavía no sé en qué departamento vives. Elígelo arriba y te digo tu cuota del mes.', lleva: null }
      }
      const c = await llamar('cuotaDe', {}, contexto, llamadas)
      if (c.valido === false) {
        return {
          texto: `${capitalizar(String(c.nombreMes ?? 'ese mes'))} todavía no está cerrado, así que la cuota no está calculada. En cuanto se cierre te la puedo desglosar.`,
          lleva: null,
        }
      }
      const pagos = await llamar('estadoPagos', {}, contexto, llamadas)
      const mio = contexto.dpto
      const comoVa = (pagos.alDia as string[]).includes(mio)
        ? 'Ya está pagada y confirmada.'
        : (pagos.enVerificacion as string[]).includes(mio)
          ? 'Ya avisaste el depósito y queda por confirmar.'
          : 'Todavía no hay pago registrado.'
      return {
        texto:
          `Tu cuota de ${String(c.nombreMes)} es S/ ${fmt(c.total as number)}, entre S/ ${fmt(c.mantenimiento as number)} ` +
          `de mantenimiento y S/ ${fmt(c.agua as number)} de agua. ${comoVa}`,
        lleva: { hoja: 'calculo', etiqueta: 'Ver de dónde sale cada monto' },
      }
    }

    /**
     * El agua. La que más dudas genera, porque el monto no sale solo del
     * medidor propio.
     *
     * Por eso la segunda frase **explica de dónde salen los m³** en vez de
     * repetir la cifra con otras palabras: lo que marcó el medidor, la parte
     * del área común y, si lo tiene, el lavado. Es la diferencia entre decir
     * el número y decir por qué es ese número.
     */
    case 'agua': {
      const mes = await llamar('calcularMes', {}, contexto, llamadas)
      if (!contexto.dpto) {
        return {
          texto:
            mes.valido === false
              ? 'Todavía no está cargado el recibo de SEDAPAL de este mes, así que el agua no está repartida.'
              : `El edificio consumió ${String(mes.aguaM3)} m³ en ${String(mes.nombreMes)} y SEDAPAL facturó S/ ${fmt(mes.facturaAgua as number)}. Eso es lo que se reparte entre los siete.`,
          lleva: null,
        }
      }
      const consumo = await llamar('consumoDe', {}, contexto, llamadas)
      const meses = (consumo.meses ?? []) as { nombreMes: string; m3: number }[]
      const ultimo = meses[meses.length - 1]
      const anterior = meses[meses.length - 2]
      if (!ultimo) {
        return { texto: 'Todavía no hay lecturas cargadas de tu medidor, así que no puedo decirte tu consumo.', lleva: null }
      }
      const c = await llamar('cuotaDe', {}, contexto, llamadas)
      const desglose =
        c.valido === false
          ? ''
          : ` Tu medidor marcó ${fmt(c.m3medidos as number)} m³ y el resto es tu parte del área común` +
            ((c.lavado as number) > 0 ? `, más ${fmt(c.lavado as number)} del lavado del carro.` : '.')
      return {
        texto: anterior
          ? `En ${ultimo.nombreMes} te tocaron ${fmt(ultimo.m3)} m³ y en ${anterior.nombreMes} fueron ${fmt(anterior.m3)}, con un promedio del año de ${fmt(consumo.promedio as number)}.${desglose}`
          : `En ${ultimo.nombreMes} te tocaron ${fmt(ultimo.m3)} m³, y es el primer mes cargado, así que todavía no hay con qué compararlo.${desglose}`,
        lleva: { hoja: 'agua', etiqueta: 'Ver mi consumo mes a mes' },
      }
    }

    /**
     * Cómo van los pagos.
     *
     * Lo bueno primero (`05` §3) y **lo pendiente sin sujeto que juzgar**: «del
     * 501 todavía no hay aviso», no «el 501 no ha avisado». Es la misma
     * información y no señala a nadie, que es lo que `05` §2 pide con «datos,
     * no caracteres». Nunca «moroso», «deudor» ni «vencido».
     */
    case 'pagos': {
      const p = await llamar('estadoPagos', {}, contexto, llamadas)
      const faltan = (p.sinRegistrar as string[]).map((d) => `del ${d}`)
      const verificando = (p.enVerificacion as string[]).map((d) => `del ${d}`)
      const bueno = `${capitalizar(String(p.nombreMes))} va con ${String(p.cuantosAlDia)} de ${String(p.deCuantos)} pagos confirmados`
      if (faltan.length === 0 && verificando.length === 0) {
        return { texto: `${bueno}, o sea los siete. Mes cerrado y sin nada pendiente.`, lleva: null }
      }
      const pendiente = [
        verificando.length > 0 ? `${enumerar(verificando)} falta confirmar el depósito` : '',
        faltan.length > 0 ? `${enumerar(faltan)} todavía no hay aviso` : '',
      ].filter(Boolean)
      return { texto: `${bueno}. ${capitalizar(pendiente.join(', y '))}.`, lleva: null }
    }

    /**
     * El lavado del carro. La reasignación que más se pregunta.
     *
     * El texto sale de la herramienta, que es donde vive la frase de `05` §3
     * con las cifras del mes puestas.
     */
    case 'lavado': {
      const l = await llamar('explicaLavado', {}, contexto, llamadas)
      if (l.valido === false) {
        return { texto: 'Ese mes todavía no está cerrado, así que el lavado no está repartido. Te lo puedo explicar en cuanto se cierre.', lleva: null }
      }
      if (l.activo === false) {
        return {
          texto: `En ${String(l.nombreMes)} el lavado no se cobró, así que el área común se repartió completa entre los siete. Cuando está activo, esos m³ se le cargan al 401 y se restan del área común.`,
          lleva: { hoja: 'calculo', etiqueta: 'Ver de dónde sale cada monto' },
        }
      }
      return { texto: String(l.explicacion), lleva: { hoja: 'calculo', etiqueta: 'Ver de dónde sale cada monto' } }
    }

    /**
     * En qué se gastó.
     *
     * Además de los dos conceptos más grandes, avisa si queda algún monto por
     * confirmar. Ese dato cambia cómo se lee el total, y no estaba.
     */
    case 'gastos': {
      const g = await llamar('gastosDe', {}, contexto, llamadas)
      if (g.valido === false) {
        return { texto: `${capitalizar(String(g.nombreMes ?? 'ese mes'))} todavía no está cerrado, así que los gastos pueden moverse. Te los cuento cuando se cierre.`, lleva: null }
      }
      const todos = g.gastos as { concepto: string; monto: number | null; porConfirmar: boolean }[]
      const grandes = todos
        .filter((x) => x.monto !== null)
        .sort((a, b) => (b.monto ?? 0) - (a.monto ?? 0))
        .slice(0, 2)
      const porConfirmar = todos.filter((x) => x.porConfirmar).map((x) => x.concepto)
      const cola =
        porConfirmar.length > 0
          ? ` Ojo que ${enumerar(porConfirmar)} ${porConfirmar.length === 1 ? 'está' : 'están'} por confirmar.`
          : ''
      return {
        texto:
          `${capitalizar(String(g.nombreMes))} costó S/ ${fmt(g.total as number)} entre los siete. ` +
          `Lo más grande fue ${grandes.map((x) => `${x.concepto} con S/ ${fmt(x.monto ?? 0)}`).join(', y después ')}.${cola}`,
        lleva: { hoja: 'calculo', etiqueta: 'Ver de dónde sale cada monto' },
      }
    }

    /**
     * El saldo de la cuenta conjunta.
     *
     * Dice **si el fondo subió o bajó**, que es la lectura que importa y que la
     * versión anterior dejaba a cargo del vecino: enseñaba tres cifras y que él
     * dedujera cuál era mayor.
     */
    case 'saldo': {
      const s = await llamar('serieSaldo', {}, contexto, llamadas)
      const meses = s.meses as { nombreMes: string; saldo: number; recibido: number; gastado: number }[]
      const ultimo = meses[meses.length - 1]
      if (!ultimo) return { texto: 'Todavía no hay meses cerrados, así que la cuenta no tiene movimientos que sumar.', lleva: null }
      const movimiento =
        ultimo.recibido > ultimo.gastado
          ? 'así que el fondo subió'
          : ultimo.recibido < ultimo.gastado
            ? 'así que el fondo bajó'
            : 'así que el fondo quedó igual'
      return {
        texto:
          `En ${ultimo.nombreMes} entraron S/ ${fmt(ultimo.recibido)} y salieron S/ ${fmt(ultimo.gastado)}, ${movimiento}. ` +
          `La cuenta conjunta cerró el mes en S/ ${fmt(ultimo.saldo)}.`,
        lleva: null,
      }
    }

    /**
     * Comparar dos meses.
     *
     * La segunda frase dice **de dónde viene la diferencia**, agua o el resto,
     * con las dos cifras que devuelve la herramienta. Antes solo daba los dos
     * totales y el vecino se quedaba con la pregunta de siempre: por qué.
     */
    case 'comparar': {
      const c = await llamar('comparaMeses', {}, contexto, llamadas)
      if (c.valido === false) return { texto: 'Todavía no hay dos meses cerrados que comparar. Con el siguiente cierre ya te puedo decir qué cambió.', lleva: null }
      const dif = c.diferenciaTotal as number
      const mesB = capitalizar(String(c.nombreMesB))
      const mesA = String(c.nombreMesA)
      if (dif === 0) {
        return { texto: `${mesB} costó lo mismo que ${mesA}: S/ ${fmt(c.totalB as number)} los dos.`, lleva: { hoja: 'calculo', etiqueta: 'Ver de dónde sale cada monto' } }
      }
      const difAgua = c.diferenciaAgua as number
      const difResto = c.diferenciaResto as number
      const porQue =
        Math.abs(difAgua) >= Math.abs(difResto)
          ? `Casi todo es el agua: SEDAPAL facturó S/ ${fmt(c.facturaAguaB as number)} contra S/ ${fmt(c.facturaAguaA as number)}.`
          : `El agua se movió S/ ${fmt(Math.abs(difAgua))} y los otros gastos S/ ${fmt(Math.abs(difResto))}, así que el grueso no es el agua.`
      return {
        texto:
          `${mesB} costó S/ ${fmt(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'} que ${mesA}, ` +
          `S/ ${fmt(c.totalB as number)} contra S/ ${fmt(c.totalA as number)}. ${porQue}`,
        lleva: { hoja: 'calculo', etiqueta: 'Ver de dónde sale cada monto' },
      }
    }

    default:
      /**
       * Lo que no sabe. `05` §2: **si no tiene el dato, lo dice**.
       *
       * Y ofrece la lista de lo que sí hay, en vez de disculparse. Sin «lo
       * siento», sin «como asistente» y sin «¿quieres que profundice?».
       */
      return {
        texto:
          'De eso no tengo dato. Te puedo contar tu cuota del mes, tu consumo de agua, en qué se fue la plata, ' +
          'cómo va el fondo de la cuenta o cómo van los pagos.',
        lleva: null,
      }
  }
}
