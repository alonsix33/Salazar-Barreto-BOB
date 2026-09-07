import { defineConfig, devices } from '@playwright/test'

/**
 * Los tests de extremo a extremo.
 *
 * Corren contra la app **construida**, no contra el servidor de desarrollo: lo
 * que se prueba tiene que ser lo que se despliega.
 */
/**
 * El puerto es **uno**, y de él sale todo.
 *
 * `use.baseURL` y `webServer.port` eran independientes: con `BASE_URL` puesta,
 * Playwright construía y levantaba su servidor en el 3200 —un minuto largo— y
 * después visitaba otro sitio. Medido: `BASE_URL=http://localhost:3111` corría
 * los tests contra un `next dev` ajeno sirviendo otro `.next`, en verde. El
 * comentario de abajo decía que eso estaba resuelto, y no lo estaba.
 *
 * Ahora `BASE_URL` solo puede cambiar el puerto, y el servidor se levanta en
 * ese mismo puerto. No hay forma de apuntar a un servidor que Playwright no
 * haya construido.
 */
const PUERTO = Number(process.env.PUERTO_E2E ?? 3200)
if (!Number.isInteger(PUERTO) || PUERTO < 1024 || PUERTO > 65535) {
  throw new Error(`PUERTO_E2E no es un puerto válido: ${process.env.PUERTO_E2E}`)
}
const BASE = `http://localhost:${PUERTO}`

export default defineConfig({
  testDir: './tests/e2e',
  /**
   * Un worker, en orden. **La base de datos es una sola.**
   *
   * Se intentó lo contrario —los de solo lectura en paralelo, los que escriben
   * con un cerrojo— y no se sostiene: mientras un test del cierre resiembra, la
   * base se queda unos milisegundos sin departamentos, y un test de responsive
   * que estaba pintando Inicio en ese instante se cae. Medido: cuatro rojos que
   * no eran del producto.
   *
   * Con un worker no hay cerrojo que valga ni carrera que perseguir, y la suite
   * entera cuesta poco más que antes. Un rojo tampoco arrastra a los demás: eso
   * era `mode: 'serial'`, y lo que hacía era marcar los siguientes del fichero
   * como *did not run* y esconder dos huecos detrás de un fallo.
   */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    // El departamento elegido va en una cookie: sin ella solo se ve el onboarding.
    storageState: {
      cookies: [
        {
          name: 'sb_dpto', value: '401', domain: 'localhost', path: '/',
          expires: -1, httpOnly: false, secure: false, sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },
  /**
   * El servidor lo levanta Playwright, **construyendo antes**.
   *
   * Antes se daba por hecho que había un `next start` corriendo. Uno que llevaba
   * media hora arriba seguía sirviendo el `.next` que un `next build` posterior
   * había reemplazado: los catorce chunks de JavaScript devolvían 400, la página
   * se pintaba en el servidor y no reaccionaba a nada, y el fallo salía como
   * "no aparece el diálogo" en un test que no tenía nada que ver. Reconstruir
   * cuesta un minuto y quita esa clase entera de fallo — junto con `PUERTO`
   * arriba, que impide apuntar los tests a un servidor distinto del que se
   * acaba de construir.
   */
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    port: PUERTO,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    /**
     * El resembrado se abre **solo aquí**. Es la ruta que borra la base y la
     * vuelve a escribir desde la semilla: sin esta variable el endpoint no
     * existe, y por eso no puede vivir en `.env`.
     */
    env: { PERMITIR_RESEMBRADO: 'si' },
  },
  projects: [
    {
      name: 'movil',
      use: {
        ...devices['Pixel 7'],
        /**
         * El Chromium del entorno, que no coincide con el que Playwright espera.
         *
         * En integración continua no se pone nada: allí `playwright install`
         * deja el suyo donde toca y hay que dejarle usarlo. Un `CHROMIUM=''`
         * **no** es lo mismo que no ponerlo —`??` solo cubre `undefined`, y una
         * cadena vacía como `executablePath` revienta el arranque—, así que se
         * comprueba que tenga contenido.
         */
        launchOptions: process.env.CHROMIUM
          ? { executablePath: process.env.CHROMIUM }
          : process.env.CI
            ? {}
            : { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
      },
    },
  ],
})
