import type { MetadataRoute } from 'next'
import { COPYS } from '@/lib/copys'
import { COLOR_TEMA } from '@/lib/tema'

/**
 * El manifiesto de la PWA. Fase 6, punto 1.
 *
 * Se genera desde código, no como un `.json` suelto, para que el nombre salga de
 * `COPYS` y el color de tema salga de `lib/tema.ts` —que a su vez tiene un test
 * que lo compara con el token de `globals.css`—. Un manifiesto escrito a mano es
 * el sitio clásico donde un color se queda atrás cuando cambia la paleta.
 *
 * `display: 'standalone'` y no `fullscreen`: en pantalla completa iOS esconde la
 * barra de estado y el reloj, y esta app se consulta de pie en el ascensor. El
 * arranque sin barra de navegador es lo que pide el enunciado; esconder la hora
 * del teléfono, no.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: COPYS.app.nombre,
    short_name: COPYS.app.nombreCorto,
    description: COPYS.app.descripcion,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: COLOR_TEMA,
    theme_color: COLOR_TEMA,
    lang: 'es-PE',
    dir: 'ltr',
    categories: ['finance', 'utilities'],
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/iconos/icono-recortable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/iconos/icono-recortable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
