import { cookies } from 'next/headers'
import { z } from 'zod'
import { MAX_PREGUNTA, preguntarABob } from '@/lib/bob'
import { MAX_TURNO, MAX_TURNOS } from '@/lib/bob/tipos'
import { zDpto, zMes } from '@/lib/esquemas/comunes'
import { COOKIE_ADMIN, sesionValida } from '@/lib/servicios/admin'
import { leerCuerpo, responder } from '@/lib/servicios/ruta'

/**
 * `POST /api/bob` · preguntarle algo a Bob.
 *
 * Es `POST` porque lleva un cuerpo, no porque escriba: **esta ruta no escribe
 * nada** salvo su propio registro de auditoría. Fase 8 §8.4.2 lo pide sin
 * excepción, y se cumple por construcción — `lib/bob/herramientas.ts` solo
 * importa lectores, y un test lo comprueba.
 *
 * `esAdmin` **no viene del cliente**: se saca de la cookie de sesión aquí. Si
 * viniera en el cuerpo, cualquiera podría mandarlo en `true` y preguntarle a
 * Bob cuánto debe el vecino del 501.
 *
 * ## Quién recibe qué, y por qué no se cruzan
 *
 * Cada petición trae su propio departamento y su respuesta vuelve en la misma
 * respuesta HTTP, al navegador que preguntó. No hay buzón compartido ni cola:
 * si el 401 y el 202 preguntan a la vez, son dos peticiones independientes y
 * ninguna sabe de la otra. En `consulta_bob` quedan las dos, cada una con su
 * departamento.
 *
 * El **hilo** sí lo guarda el navegador y lo manda de vuelta: es lo que permite
 * que «¿y el mes pasado?» signifique algo. Va acotado y se trata como texto de
 * fuera; ver `Turno` en `lib/bob/tipos.ts`.
 */
const zTurno = z.object({
  de: z.enum(['vecino', 'bob']),
  texto: z.string().trim().min(1).max(MAX_TURNO),
})

const zPregunta = z.object({
  texto: z.string().trim().min(1, 'Escribe una pregunta.').max(MAX_PREGUNTA, 'Esa pregunta es demasiado larga.'),
  mes: zMes,
  dpto: zDpto.nullable().optional(),
  /** Los turnos anteriores de esta misma conversación. Los guarda el navegador. */
  historial: z.array(zTurno).max(MAX_TURNOS).optional(),
})

export async function POST(peticion: Request) {
  return responder(async () => {
    const { texto, mes, dpto, historial } = await leerCuerpo(peticion, zPregunta)
    const tarro = await cookies()
    const esAdmin = sesionValida(tarro.get(COOKIE_ADMIN)?.value)
    const r = await preguntarABob(texto, { mes, dpto: dpto ?? null, esAdmin }, historial ?? [])
    // Las llamadas a herramienta se quedan en el servidor: al cliente le
    // interesa la respuesta, no de dónde salió cada cifra. En la tabla
    // `consulta_bob` está entero.
    return { texto: r.texto, lleva: r.lleva }
  })
}
