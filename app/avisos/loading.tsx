import { Esqueleto } from '@/components/ui/Esqueleto'

/**
 * Igual que el de las pestañas, pero **sin el hueco de la navegación
 * inferior**: esta pantalla no la lleva (`NavSiCorresponde`), y reservarle sitio
 * dejaba un margen abajo que luego desaparecía, con el contenido dando un salto.
 */
export default function Cargando() {
  return <Esqueleto conNav={false} filas={3} />
}
