/**
 * Un cerrojo entre procesos para todo lo que **escribe en la base de pruebas**.
 *
 * Hay una sola base y la comparten la suite de extremo a extremo, la de
 * integración, las pruebas negativas y cualquier `next dev` que alguien tenga
 * abierto. Sin cerrojo se pisan: se vio un `P2003` —violación de clave foránea
 * escribiendo una lectura— porque otro proceso había borrado los departamentos
 * a mitad, y un `resembrar()` reventar porque alguien insertó un pago entre el
 * borrado de pagos y el de departamentos. El rojo aparecía en el fichero que no
 * tenía la culpa, que es la peor forma de depurar algo.
 *
 * La creación con `wx` es atómica en el sistema de ficheros: no hay carrera
 * entre comprobar y crear.
 *
 * **Y se limpia solo.** La primera versión dejaba el fichero puesto si el
 * proceso moría —Ctrl-C, `--max-failures`, un OOM— y a partir de ahí *todas* las
 * corridas siguientes fallaban con un mensaje que no decía por qué. Ahora
 * dentro va el PID: si el proceso que lo tomó ya no existe, el cerrojo está
 * huérfano y se recoge.
 */
import { existsSync, mkdirSync, openSync, closeSync, writeSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CARPETA = join(tmpdir(), 'salazar-barreto-e2e')
const CERROJO = join(CARPETA, 'base.lock')

/** ¿Sigue vivo el proceso que dejó este cerrojo? */
function vivo(pid: number): boolean {
  try {
    // La señal 0 no manda nada: solo comprueba que el proceso existe.
    process.kill(pid, 0)
    return true
  } catch (e) {
    // `EPERM` significa que existe pero es de otro usuario: sigue vivo.
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function recogerSiHuerfano(): void {
  if (!existsSync(CERROJO)) return
  try {
    const pid = Number(readFileSync(CERROJO, 'utf8').split('\n')[0])
    if (Number.isInteger(pid) && pid > 0 && vivo(pid)) return
    unlinkSync(CERROJO)
  } catch {
    // Se lo llevó otro entre la comprobación y el borrado. Bien está.
  }
}

let tomadoPorNosotros = false

/**
 * Toma el cerrojo, esperando a que se suelte.
 *
 * @param esperaMs Cuánto esperar antes de rendirse. Tiene que ser **menor** que
 *                 el tiempo límite de quien llama, o el mensaje de aquí no se
 *                 llega a imprimir nunca: el primer intento se pasó de 180 s con
 *                 un límite de test de 30, y lo único que se veía era
 *                 `Test timeout of 30000ms exceeded while setting up`, sin una
 *                 palabra del cerrojo ni de su ruta.
 */
export async function tomarCerrojo(esperaMs = 20_000): Promise<void> {
  // Re-entrante dentro del mismo proceso: quien ya lo tiene, lo tiene. Sin esto,
  // un `resembrar()` en cada `beforeEach` se bloquearía a sí mismo en el segundo.
  if (tomadoPorNosotros) return
  mkdirSync(CARPETA, { recursive: true })
  const limite = Date.now() + esperaMs
  for (;;) {
    recogerSiHuerfano()
    try {
      const fd = openSync(CERROJO, 'wx')
      writeSync(fd, `${process.pid}\n${new Date().toISOString()}\n`)
      closeSync(fd)
      tomadoPorNosotros = true
      return
    } catch {
      if (Date.now() > limite) {
        const de = existsSync(CERROJO) ? readFileSync(CERROJO, 'utf8').trim() : '(ya no está)'
        throw new Error(
          `No se pudo tomar el cerrojo de la base en ${esperaMs / 1000} s.\n` +
            `Fichero: ${CERROJO}\nLo tiene: ${de}\n` +
            'Si no hay nadie escribiendo en la base, bórralo y vuelve a correr.',
        )
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}

export function soltarCerrojo(): void {
  if (!tomadoPorNosotros) return
  tomadoPorNosotros = false
  try {
    unlinkSync(CERROJO)
  } catch {
    // Ya estaba suelto. No es un fallo.
  }
}

// Red de seguridad: si el proceso se va por donde sea, el cerrojo no se queda.
for (const senal of ['exit', 'SIGINT', 'SIGTERM', 'uncaughtException'] as const) {
  process.on(senal, () => {
    soltarCerrojo()
    if (senal === 'SIGINT' || senal === 'SIGTERM') process.exit(130)
  })
}
