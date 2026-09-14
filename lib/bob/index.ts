/**
 * Bob. La única puerta. Fase 8 §8.1 y §8.4.
 *
 * Aquí se decide con qué se responde y, sobre todo, **qué respuesta se
 * publica**. Las cinco guardas duras del enunciado se cumplen en este fichero o
 * en los que importa, y ninguna vive en el prompt:
 *
 *  1. **Longitud.** `aDosFrases`, siempre, venga de donde venga el texto.
 *  2. **Sin escritura.** `herramientas.ts` solo importa lectores, y hay un test
 *     que comprueba que ahí no aparece un `create`, `update` ni `delete`.
 *  3. **Verificación de números.** `numerosInventados`. Si aparece una cifra que
 *     no salió de una herramienta llamada en esta conversación, la respuesta del
 *     modelo se descarta entera y se responde con el determinista.
 *  4. **Registro completo.** Pregunta, llamadas y respuesta, en `consulta_bob`.
 *  5. **Tiempo de espera y respaldo.** Ocho segundos; pasados, el determinista,
 *     y el vecino no ve un error.
 *
 * El vecino **nunca ve una caída**. Ve una respuesta más corta y sin
 * florituras, y ya. Que el modelo se haya caído es un problema nuestro, y sale
 * en la tabla de registro, no en su pantalla.
 */

import { prisma } from '@/lib/datos/prisma'
import { responderDeterminista } from './determinista'
import { hayClave, PlazoAgotado, RespuestaCortada, preguntarADeepseek } from './deepseek'
import { aDosFrases, numerosInventados } from './guardas'
import type { Contexto, Llamada, MotivoCaida, Respuesta, Turno } from './tipos'

export type { Contexto, Respuesta } from './tipos'

/**
 * Con qué responde Bob. **La clave manda.**
 *
 * Antes hacían falta dos variables de acuerdo —`DEEPSEEK_API_KEY` y
 * `BOB_MODO=deepseek`—, y una implica a la otra: nadie paga una clave para no
 * usarla. En producción estaba la clave y no estaba `BOB_MODO`, así que Bob
 * contestaba con el catálogo, que responde a todo y nunca falla. No había error
 * en ningún sitio; solo un Bob más tonto de lo que debía, y ninguna forma de
 * notarlo desde fuera. Por eso `panelDeAdmin` publica ahora el modo y el motivo:
 * el estado de Bob se mira, no se deduce.
 *
 * Las tres reglas, en orden:
 *
 *  1. `BOB_SIN_MODELO` con cualquier valor → catálogo, aunque haya clave. Es el
 *     freno de mano explícito: para cortar el gasto sin borrar la clave.
 *  2. `BOB_MODO=deepseek` → modelo. Fuerza el camino aunque no haya clave, que
 *     es lo que necesitan los tests del caso «sin clave, ni lo intenta».
 *  3. Si no, **manda la clave**: con clave, el modelo; sin clave, el catálogo.
 *
 * `BOB_MODO=determinista` ya no apaga el modelo, y no es un descuido: era el
 * valor que `docs/DESPLIEGUE.md` mandaba poner antes de que existiera la clave,
 * y quedarse ahí callando a Bob es justo el fallo que esto arregla.
 */
export function modoDeBob(): 'determinista' | 'deepseek' {
  if (process.env.BOB_SIN_MODELO) return 'determinista'
  if (process.env.BOB_MODO === 'deepseek') return 'deepseek'
  return hayClave() ? 'deepseek' : 'determinista'
}

/** Por qué Bob está en el modo en el que está, en una frase para el panel. */
export function porQueEseModo(): string {
  if (process.env.BOB_SIN_MODELO) return 'BOB_SIN_MODELO está puesta: responde solo con el catálogo.'
  if (process.env.BOB_MODO === 'deepseek' && !hayClave()) {
    return 'BOB_MODO=deepseek pero falta DEEPSEEK_API_KEY: responde con el catálogo.'
  }
  if (hayClave()) return 'Hay DEEPSEEK_API_KEY: Bob responde con el modelo.'
  return 'No hay DEEPSEEK_API_KEY: Bob responde con el catálogo.'
}

/** Lo más largo que se acepta de una pregunta. Más que esto no es una pregunta. */
export const MAX_PREGUNTA = 400

export async function preguntarABob(
  texto: string,
  contexto: Contexto,
  historial: readonly Turno[] = [],
): Promise<Respuesta> {
  const arranque = Date.now()
  const respuesta = await resolver(texto, contexto, historial)
  await registrar(texto, contexto, respuesta, Date.now() - arranque)
  return respuesta
}

async function resolver(
  texto: string,
  contexto: Contexto,
  historial: readonly Turno[],
): Promise<Respuesta> {
  /**
   * El catálogo **no usa el hilo**, y es una limitación conocida, no un olvido.
   * Resuelve por palabras clave de la pregunta actual: para entender «¿y el mes
   * pasado?» haría falta arrastrar la intención anterior, y un catálogo que
   * adivina de qué se hablaba se equivoca de tema con cara de certeza. Sin
   * clave, Bob contesta cada pregunta por separado y lo hace bien.
   */
  if (modoDeBob() === 'determinista') return await conElCatalogo(texto, contexto, null)
  if (!hayClave()) return await conElCatalogo(texto, contexto, 'sin-clave')

  let llamadas: Llamada[] = []
  try {
    const delModelo = await preguntarADeepseek(texto, contexto, historial)
    llamadas = delModelo.llamadas

    const dicho = aDosFrases(delModelo.texto)
    if (!dicho) return await conElCatalogo(texto, contexto, 'respuesta-vacia', llamadas)

    /**
     * **La guarda que impide que Bob invente cifras.**
     *
     * No se corrige la cifra ni se recorta la frase: se tira la respuesta
     * entera. Una respuesta con un número que no salió de ninguna herramienta
     * no tiene un error puntual —tiene un origen desconocido—, y no hay forma
     * de saber qué otra parte de la frase salió del mismo sitio.
     */
    const inventados = numerosInventados(dicho, llamadas)
    if (inventados.length > 0) {
      console.warn('[bob] cifras sin herramienta detrás:', inventados.join(', '))
      return await conElCatalogo(texto, contexto, 'numero-inventado', llamadas)
    }

    return {
      texto: dicho,
      // El enlace a la pantalla que lo demuestra lo pone el determinista, que
      // sabe de qué se está hablando. El modelo redacta; no navega.
      lleva: (await responderDeterminista(texto, contexto)).lleva,
      modo: 'deepseek',
      motivoCaida: null,
      llamadas,
    }
  } catch (e) {
    const motivo: MotivoCaida =
      e instanceof PlazoAgotado ? 'tiempo-agotado' : e instanceof RespuestaCortada ? 'respuesta-cortada' : 'error-del-modelo'
    console.warn('[bob] se cayó al determinista:', motivo, e instanceof Error ? e.message : e)
    return await conElCatalogo(texto, contexto, motivo, llamadas)
  }
}

/** El suelo. Nunca falla, y por eso todo lo demás puede fallar sin ruido. */
async function conElCatalogo(
  texto: string,
  contexto: Contexto,
  motivoCaida: MotivoCaida | null,
  llamadasPrevias: Llamada[] = [],
): Promise<Respuesta> {
  const r = await responderDeterminista(texto, contexto, llamadasPrevias)
  return {
    // El catálogo ya escribe en dos frases, pero se pasa por la misma guarda:
    // un límite que solo se aplica a una rama no es un límite.
    texto: aDosFrases(r.texto),
    lleva: r.lleva,
    modo: 'determinista',
    motivoCaida,
    llamadas: r.llamadas,
  }
}

/**
 * Guarda la conversación entera. Fase 8 §8.4.4.
 *
 * **Si el registro falla, la respuesta sale igual.** Se pensó al revés —no
 * responder sin poder auditar— y es peor: dejaría a Bob mudo por un problema de
 * base de datos que al vecino no le importa, y Bob solo lee. El fallo se ve en
 * el log del servidor.
 */
async function registrar(
  pregunta: string,
  contexto: Contexto,
  respuesta: Respuesta,
  ms: number,
): Promise<void> {
  try {
    await prisma.consultaBob.create({
      data: {
        dpto: contexto.dpto,
        mes: contexto.mes,
        esAdmin: contexto.esAdmin,
        pregunta,
        respuesta: respuesta.texto,
        modo: respuesta.modo,
        motivoCaida: respuesta.motivoCaida,
        llamadas: respuesta.llamadas as unknown as object[],
        ms,
      },
    })
  } catch (e) {
    console.error('[bob] no se pudo registrar la consulta:', e)
  }
}
