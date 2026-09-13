import { Esqueleto } from '@/components/ui/Esqueleto'

/**
 * Lo que se ve mientras el servidor arma Inicio.
 *
 * Sin esto, cambiar de pestaña deja el teléfono con la pantalla anterior
 * congelada hasta que llega la nueva, y el vecino vuelve a tocar creyendo que no
 * registró el toque. Con esto la pestaña cambia al instante.
 *
 * **Vive en un grupo de rutas `(inicio)` y no en la raíz de `app/`.** Un
 * `loading.tsx` cubre su segmento y todo lo que cuelga de él, así que puesto en
 * la raíz cubría también `/mes`, que no pinta nada: solo redirige al último mes
 * publicado. El resultado era un esqueleto que aparecía y acto seguido navegaba
 * a otro sitio —dos pasos y dos URLs para un toque— y el e2e de accesibilidad lo
 * cazó: la página se destruía debajo del test. El grupo de rutas no cambia
 * ninguna URL; solo acota hasta dónde llega esta espera.
 */
export default function Cargando() {
  return <Esqueleto />
}
