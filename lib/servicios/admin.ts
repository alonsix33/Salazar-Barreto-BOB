/**
 * El PIN de administración. `06-modelo-de-datos.md` §5.
 *
 * Tres cosas que no se negocian:
 *
 *  1. **Se valida en el servidor.** `ADMIN_PIN` es una variable de entorno del
 *     servidor y nunca entra en el bundle del cliente. La Fase 7 lo comprueba
 *     grepeando el bundle.
 *  2. **Con límite de intentos por IP.** Cuatro dígitos son diez mil
 *     combinaciones: sin límite se prueban todas en un rato.
 *  3. **La comparación es de tiempo constante**, para no filtrar el PIN por lo
 *     que tarda en responder.
 *  4. **La cookie de sesión se firma con otra clave, no con el PIN.** Ver
 *     `claveDeFirma` más abajo: firmarla con el PIN convertía cualquier cookie
 *     robada en el PIN entero en cuestión de milisegundos.
 *
 * El modelo mental del usuario no cambia: el PIN incorrecto sacude el campo y lo
 * limpia. No hay mensaje de "no tienes permiso" (`README` §7).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/datos/prisma'
import { demasiadosIntentos, sinPermiso } from './errores'

/** Nombre de la cookie de sesión de administración. */
export const COOKIE_ADMIN = 'sb_admin'

/** Cuánto dura una sesión de administración. */
export const DURACION_SESION_MS = 60 * 60 * 1000 // una hora

const VENTANA_MS = 15 * 60 * 1000 // quince minutos
const MAX_INTENTOS = 8

/**
 * El techo **global** de intentos fallidos en la ventana, sumando todas las IP.
 *
 * El límite por IP no basta, y esto es la lección de un agujero real que
 * encontró la auditoría final: quien ataca controla la cabecera
 * `x-forwarded-for`, así que puede presentar una IP distinta en cada intento y
 * no tocar nunca el tope por IP. Medido contra la app construida: con la IP
 * fija, el noveno intento daba 429; rotándola, los diez mil PINes quedaban al
 * alcance sin un solo 429.
 *
 * Un PIN de cuatro dígitos son diez mil combinaciones. Con 40 fallos por
 * ventana de quince minutos —vengan de una IP o de diez mil— recorrer el
 * espacio entero llevaría más de un día de bloqueos encadenados, y cada ventana
 * deja rastro en `intento_pin` para que se vea el ataque. Para siete vecinos que
 * teclean cuatro dígitos, 40 fallos cada quince minutos no estorban jamás.
 */
const MAX_GLOBAL = 40

function secreto(): string {
  const pin = process.env.ADMIN_PIN
  if (!pin) throw new Error('Falta ADMIN_PIN en el entorno del servidor.')
  return pin
}

/**
 * La clave con la que se firma la cookie de sesión. **No es el PIN.**
 *
 * Firmarla con el PIN era un agujero de verdad: el PIN tiene cuatro dígitos, o
 * sea diez mil posibilidades. Con una sola cookie válida en la mano —del
 * historial del navegador, de un registro, de un aparato prestado— se calculan
 * las diez mil firmas y se ve cuál coincide. En un portátil eso son
 * milisegundos, y el límite de ocho intentos por IP no protege de nada porque el
 * ataque no toca el servidor.
 *
 * Con una clave larga aparte, una cookie robada sirve hasta que caduca —una
 * hora— y no revela el PIN.
 *
 * Si `ADMIN_SECRETO` falta, **no se inventa una**: una clave generada al vuelo
 * cambiaría en cada arranque y en cada función de Vercel, tirando las sesiones
 * sin explicación. Falta una variable, y se dice.
 */
function claveDeFirma(): string {
  const clave = process.env.ADMIN_SECRETO
  if (!clave || clave.length < 32) {
    throw new Error(
      'Falta ADMIN_SECRETO en el entorno del servidor, o es demasiado corta ' +
        '(mínimo 32 caracteres). Genera una con: openssl rand -base64 32',
    )
  }
  return clave
}

/** Compara sin filtrar información por el tiempo que tarda. */
function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) {
    // Aun así se compara, para que el tiempo no dependa de la longitud.
    timingSafeEqual(ba, ba)
    return false
  }
  return timingSafeEqual(ba, bb)
}

/**
 * Valida el PIN y devuelve el valor de la cookie de sesión.
 *
 * @throws 429 si esa IP ya gastó sus intentos; 401 si el PIN no es.
 */
export async function validarPin(pin: string, ip: string): Promise<{ cookie: string; expira: Date }> {
  const desde = new Date(Date.now() - VENTANA_MS)
  // Dos cuentas, no una: la de esta IP y la de todas juntas. La segunda es la
  // que sostiene el freno cuando la IP es falsa, porque `ip` viene de una
  // cabecera que quien ataca controla (ver `ipDeLaPeticion`).
  const [fallidos, fallidosGlobal] = await Promise.all([
    prisma.intentoPin.count({ where: { ip, acertado: false, momento: { gte: desde } } }),
    prisma.intentoPin.count({ where: { acertado: false, momento: { gte: desde } } }),
  ])
  if (fallidos >= MAX_INTENTOS || fallidosGlobal >= MAX_GLOBAL) {
    // Se registra también el intento bloqueado: si alguien está probando, tiene
    // que verse en la auditoría.
    await prisma.intentoPin.create({ data: { ip, acertado: false } })
    throw demasiadosIntentos('Demasiados intentos. Espera un rato y vuelve a probar.')
  }

  const acertado = igualSeguro(pin, secreto())
  await prisma.intentoPin.create({ data: { ip, acertado } })
  if (!acertado) throw sinPermiso('PIN incorrecto.')

  const expira = new Date(Date.now() + DURACION_SESION_MS)
  return { cookie: firmarSesion(expira), expira }
}

/** La cookie es `expira.firma`. No lleva el PIN dentro ni se firma con él. */
function firmarSesion(expira: Date): string {
  const carga = String(expira.getTime())
  const firma = createHmac('sha256', claveDeFirma()).update(carga).digest('base64url')
  return `${carga}.${firma}`
}

/** `true` si la cookie es válida y no ha caducado. */
export function sesionValida(cookie: string | undefined): boolean {
  if (!cookie) return false
  const corte = cookie.lastIndexOf('.')
  if (corte <= 0) return false
  const carga = cookie.slice(0, corte)
  const firma = cookie.slice(corte + 1)
  const esperada = createHmac('sha256', claveDeFirma()).update(carga).digest('base64url')
  if (!igualSeguro(firma, esperada)) return false
  const expira = Number(carga)
  return Number.isFinite(expira) && expira > Date.now()
}

/** Limpia los intentos viejos. Se llama de vez en cuando, no en cada petición. */
export async function limpiarIntentos(): Promise<void> {
  await prisma.intentoPin.deleteMany({ where: { momento: { lt: new Date(Date.now() - VENTANA_MS * 4) } } })
}
