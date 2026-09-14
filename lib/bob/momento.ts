/**
 * Que un momento automático pase por el modelo, y que se note lo justo.
 *
 * ## Cómo se siente
 *
 * El determinista se pinta en el servidor y llega con la página. Si hay clave,
 * el cliente pide por detrás la versión del modelo y, cuando llega, **cambia el
 * texto en su sitio**. Sin hueco, sin puntitos, sin salto: lo que había ya era
 * correcto. Si DeepSeek tarda, falla, o escribe una cifra que no le dieron, no
 * pasa absolutamente nada y se queda lo de antes.
 *
 * Esa es la diferencia con la hoja de Bob, donde sí se espera: ahí el vecino
 * preguntó y sabe que está esperando. Aquí nadie preguntó.
 *
 * ## Las guardas son las mismas
 *
 * Longitud (`aDosFrases`), ninguna cifra inventada (`numerosInventados`),
 * tiempo de espera y registro en `consulta_bob`. La única diferencia es de
 * dónde salen las cifras permitidas: en la hoja, de las herramientas que llamó;
 * aquí, de los `datos` del momento, que se le pasan **como si fueran** el
 * resultado de una herramienta. Para el caso lo son: son lo que la pantalla ya
 * calculó y está enseñando dos centímetros más allá.
 *
 * Y aquí no hay herramientas de verdad. Es a propósito: dejarle llamar a la
 * base en un texto que se dispara solo son siete consultas por pantalla que
 * nadie pidió, y el dato que necesita ya lo tiene delante.
 */

import { prisma } from '@/lib/datos/prisma'
import { hayClave, PlazoAgotado, RespuestaCortada, redactarConDeepseek } from './deepseek'
import { aDosFrases, numerosInventados } from './guardas'
import { modoDeBob } from './index'
import { MOMENTOS, type DatosMomento, type MomentoId } from './momentos'
import type { Contexto, Llamada } from './tipos'

/**
 * Lo mismo que ya se está enseñando, con forma de llamada a herramienta.
 *
 * Es lo que hace que la guarda de números sirva aquí: sin esto, cualquier cifra
 * de la respuesta sería «inventada» —no hubo llamadas— y **todas** las
 * respuestas del modelo se descartarían. En silencio, además, que es lo peor:
 * la app se vería igual de bien y el modelo no estaría haciendo nada.
 *
 * Van **dos** cosas, y la segunda no es un adorno.
 *
 * La primera son los `datos` del momento, que es lo que la pantalla calculó.
 * La segunda es el texto que el catálogo escribió con esos datos, y hace falta
 * porque el catálogo **deriva** cifras: «es tu mes más alto del año, 5.40 m³
 * sobre tu promedio» sale de 17.40 menos 12.00, y ni el 5.40 ni el 5.4 están en
 * `datos`. Sin esta segunda pieza, el modelo no podía decir lo mismo que ya
 * estaba en pantalla sin que la guarda le tirara la respuesta. Lo encontró un
 * test, no la pantalla: por fuera se habría visto perfecto.
 *
 * Y no afloja la guarda. Lo que se permite es una cifra que el vecino **está
 * viendo en ese mismo párrafo**, calculada por nosotros a partir de los datos
 * de la pantalla. Lo que sigue prohibido, que es lo que importa, es una cifra
 * que el modelo se saque de donde nadie sabe.
 */
function comoLlamada(id: MomentoId, datos: DatosMomento, yaEnPantalla: string): Llamada[] {
  return [
    { herramienta: `momento:${id}`, argumentos: {}, resultado: datos, ms: 0 },
    { herramienta: `momento:${id}:texto`, argumentos: {}, resultado: { yaEnPantalla }, ms: 0 },
  ]
}

/** Lo que se dice en un momento, sin modelo. Es lo que pinta el servidor. */
export function textoDeterminista(id: MomentoId, datos: DatosMomento): string {
  return aDosFrases(MOMENTOS[id].determinista(datos))
}

/**
 * La versión del modelo, o `null` si no la hay.
 *
 * `null` significa «quédate con lo que tienes», y es la respuesta correcta en
 * cuatro casos distintos: no hay clave, el momento no es mejorable, el modelo
 * se cayó, o escribió algo que no pasa las guardas. El cliente los trata igual
 * porque para el vecino son lo mismo.
 */
export async function mejorarMomento(
  id: MomentoId,
  datos: DatosMomento,
  contexto: Contexto,
): Promise<string | null> {
  const momento = MOMENTOS[id]
  if (!momento.mejorable) return null
  if (modoDeBob() !== 'deepseek' || !hayClave()) return null

  const base = textoDeterminista(id, datos)
  const arranque = Date.now()
  const llamadas = comoLlamada(id, datos, base)
  let motivo: string | null = null
  let dicho: string | null = null

  try {
    const crudo = await redactarConDeepseek(momento.pregunta(datos), datos, contexto)
    const corto = aDosFrases(crudo)
    if (!corto) motivo = 'respuesta-vacia'
    else {
      const inventados = numerosInventados(corto, llamadas)
      if (inventados.length > 0) {
        console.warn(`[bob] momento ${id}: cifras sin respaldo:`, inventados.join(', '))
        motivo = 'numero-inventado'
      } else if (corto === base) {
        // Dijo lo mismo. No es un fallo, pero tampoco hay nada que cambiar.
        motivo = null
        dicho = null
      } else {
        dicho = corto
      }
    }
  } catch (e) {
    motivo =
      e instanceof PlazoAgotado ? 'tiempo-agotado' : e instanceof RespuestaCortada ? 'respuesta-cortada' : 'error-del-modelo'
    console.warn(`[bob] momento ${id} se queda con el determinista:`, motivo)
  }

  await registrar(id, contexto, dicho ?? base, dicho ? 'deepseek' : 'determinista', motivo, llamadas, Date.now() - arranque)
  return dicho
}

/**
 * Al registro, igual que una pregunta.
 *
 * Lo que se guarda en `pregunta` no es lo que escribió nadie: es el momento que
 * lo disparó. Así, mirando `consulta_bob`, se ve tanto lo que le preguntaron a
 * Bob como lo que dijo por su cuenta, que es justo lo que hacía falta para
 * poder auditarlo. Antes, lo que decía solo existía en la pantalla.
 */
async function registrar(
  id: MomentoId,
  contexto: Contexto,
  respuesta: string,
  modo: 'determinista' | 'deepseek',
  motivoCaida: string | null,
  llamadas: Llamada[],
  ms: number,
): Promise<void> {
  try {
    await prisma.consultaBob.create({
      data: {
        dpto: contexto.dpto,
        mes: contexto.mes,
        esAdmin: contexto.esAdmin,
        pregunta: `[momento] ${id}`,
        respuesta,
        modo,
        motivoCaida,
        llamadas: llamadas as unknown as object[],
        ms,
      },
    })
  } catch (e) {
    // Si el registro falla, el texto sale igual. Lo contrario dejaría a Bob
    // mudo por un problema de base de datos que al vecino no le importa.
    console.error('[bob] no se pudo registrar el momento:', e)
  }
}
