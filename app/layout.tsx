import type { Metadata, Viewport } from 'next'
import { DM_Sans, JetBrains_Mono, Syne } from 'next/font/google'
import { COPYS } from '@/lib/copys'
import { Marco } from '@/components/Marco'
import { ProveedoresCliente } from './layout-cliente'
import { Hojas } from '@/components/hojas'
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
    statusBarStyle: 'default',
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
          </Marco>
        </ProveedoresCliente>
      </body>
    </html>
  )
}
