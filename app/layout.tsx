import type { Metadata, Viewport } from 'next'
import { DM_Sans, JetBrains_Mono, Syne } from 'next/font/google'
import { COPYS } from '@/lib/copys'
import { Marco } from '@/components/Marco'
import { ProveedoresCliente } from './layout-cliente'
import { Hojas } from '@/components/hojas'
import { SincronizarBarraDeEstado } from '@/components/hojas/SincronizarBarraDeEstado'
import { NavSiCorresponde } from '@/components/NavSiCorresponde'
import { AvisoVersion } from '@/components/AvisoVersion'
import { SinConexion } from '@/components/SinConexion'
import { AvisoVertical } from '@/components/AvisoVertical'
import { dptoElegido } from '@/lib/sesion'
import { COLOR_TEMA } from '@/lib/tema'
import './globals.css'

/**
 * Fuentes autoalojadas por Next. Sin `<link>` a Google Fonts: eso añade un
 * salto de red en el arranque, y esta app se abre desde el móvil en la calle.
 */
const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--fuente-syne',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--fuente-dm-sans',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--fuente-jetbrains-mono',
})

export const metadata: Metadata = {
  title: COPYS.app.nombre,
  description: COPYS.app.descripcion,
  applicationName: COPYS.app.nombreCorto,
  manifest: '/manifest.webmanifest',
  /**
   * **iOS ignora el manifiesto para el icono.** Busca `<link rel="apple-touch-icon">`
   * y, si no lo encuentra, prueba `/apple-touch-icon.png` en la raíz. Las tres
   * cosas fallaban: el fichero existía en `/iconos/` y no estaba enlazado en
   * ninguna parte, así que "Añadir a pantalla de inicio" ponía una **captura de
   * la página** en vez del icono.
   */
  icons: {
    icon: [
      { url: '/iconos/icono-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/iconos/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: COPYS.app.nombreCorto,
    /**
     * `'default'` hace que iOS reserve su propia franja opaca encima de la
     * página —el contenido se pinta debajo de la barra de estado, no
     * detrás—. El resto de la app ya asume lo contrario: `viewport-fit:
     * cover` y el relleno de `--top` (`app/globals.css`) están pensados para
     * que el fondo llegue hasta el borde real y solo el contenido se aparte
     * del notch. Con `'default'` había, en un iPhone de verdad, DOS franjas
     * sólidas antes de que empezara nada de la app: la que reserva iOS y la
     * que reserva `--top` encima de esa —la "costura" entre la barra de
     * estado y el degradado de Inicio salía de ahí, no de un hueco en el CSS.
     *
     * Probé a mantener `'default'` e inyectar `dark-content` (el reemplazo
     * moderno, vigente desde iOS 14.5) como etiqueta suelta en `other`: Next
     * sigue emitiendo su propio `<meta apple-mobile-web-app-status-bar-style
     * content="default">` desde `appleWebApp.capable`, y quedan DOS meta
     * tags compitiendo —el navegador se queda con el primero del HTML, que
     * es el de Next—. `black-translucent` es el único valor con soporte
     * real en el tipo de Next que deja el contenido detrás de la barra;
     * Apple la marca deprecada pero sigue funcionando hoy, y evita la
     * duplicidad porque usa el mismo camino de generación que `capable`.
     */
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  /**
   * `maximumScale: 5` a propósito, no 1: apagar el pellizco de zoom con
   * `userScalable: false` viola WCAG 1.4.4 —quien necesita agrandar el texto
   * se queda sin forma de hacerlo— y es justo lo que
   * `tests/e2e/bob.spec.ts` («sin violaciones de accesibilidad críticas ni
   * serias») comprueba que no pase. El zoom que sí molesta —el automático de
   * iOS al enfocar un campo— no lo causa esto: lo causa un `font-size` de
   * campo por debajo de 16px, y se arregla ahí, no aquí.
   */
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: COLOR_TEMA,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dpto = await dptoElegido()
  return (
    <html lang="es-PE" className={`${syne.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body>
        <AvisoVertical />
        <ProveedoresCliente>
          <Marco>
            <SinConexion />
            <AvisoVersion />
            {children}
            <NavSiCorresponde hayDpto={dpto !== null} />
            <Hojas />
            <SincronizarBarraDeEstado />
          </Marco>
        </ProveedoresCliente>
      </body>
    </html>
  )
}
