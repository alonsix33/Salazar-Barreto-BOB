import { Esqueleto } from '@/components/ui/Esqueleto'

/**
 * Lo que se ve mientras el servidor arma la pantalla.
 *
 * Sin esto, cambiar de pestaña deja el teléfono con la pantalla anterior
 * congelada hasta que llega la nueva, y el vecino vuelve a tocar creyendo que no
 * registró el toque. Con esto la pestaña cambia al instante.
 */
export default function Cargando() {
  return <Esqueleto />
}
