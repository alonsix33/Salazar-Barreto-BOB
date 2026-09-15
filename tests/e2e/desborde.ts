import type { Page } from '@playwright/test'

/**
 * Qué se desborda, si algo se desborda. Devuelve los culpables, no un booleano.
 *
 * **No cuenta lo que está dentro de un contenedor que scrollea a lo ancho a
 * propósito**, como el carrusel de meses de P2: ahí que un mes quede fuera de la
 * vista es la función, no un defecto. Lo que sí es un defecto es que algo empuje
 * al marco entero, y eso lo cubre la comprobación de `scrollWidth` de quien
 * llama a esta función.
 *
 * La primera versión de este chequeo no hacía esa distinción y marcaba el
 * carrusel en nueve tamaños. Un chequeo que grita donde no hay nada es un
 * chequeo que alguien acaba desactivando.
 *
 * Vivía duplicada entre `responsive.spec.ts` (que la escribió) y
 * `accesibilidad.spec.ts` (que reinventaba una versión más simple, basada en
 * el `scrollWidth` de `.pantalla` en vez de `.marco-app`): la de `.pantalla`
 * se coló con un carrusel horizontal legítimo (`.selector-meses`) marcado
 * como desborde, porque el ancho mínimo de un hijo `flex` sin `min-width:0`
 * puede propagarse al padre aunque el propio hijo scrollee bien. Una sola
 * copia, aquí, para los dos (`06` §2.7).
 */
export async function culpablesDeDesborde(
  pagina: Page,
): Promise<{ culpables: string[]; examinados: number }> {
  return pagina.evaluate(() => {
    const marco = document.querySelector('.marco-app')
    if (!marco) return { culpables: ['no se encontró .marco-app'], examinados: 0 }
    const limite = marco.getBoundingClientRect()

    /**
     * Solo se perdona lo que está dentro de un contenedor que **declara** que
     * scrollea a lo ancho, con `data-scroll-x`. Hoy hay uno: el carrusel de
     * meses de P2, donde que un mes quede fuera de la vista es la función.
     *
     * Las dos versiones anteriores de este chequeo miraban el CSS calculado y
     * las dos se desactivaban solas:
     *
     *  1. Mirando `overflow-x`: si `overflow-y` es `auto`, el CSS calcula
     *     `overflow-x: auto` aunque nadie lo escriba, así que TODO lo que
     *     estuviera dentro de una pantalla con scroll vertical quedaba exento.
     *  2. Añadiendo "y que scrollee de verdad": un desborde real convierte al
     *     padre en scroller horizontal, con lo que el desborde se excusaba a sí
     *     mismo.
     *
     * Se comprobó las dos veces metiendo una cifra de 600px en un marco de
     * 390px: el chequeo seguía en verde. Con `data-scroll-x` no hay forma de que
     * un defecto se cuele por la puerta de atrás.
     */
    const dentroDeUnScrollHorizontal = (el: HTMLElement): boolean =>
      el.closest('[data-scroll-x]') !== null

    const culpables: string[] = []
    let examinados = 0
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.marco-app *'))) {
      const caja = el.getBoundingClientRect()
      if (caja.width === 0) continue
      examinados++
      if (dentroDeUnScrollHorizontal(el)) continue
      // Un píxel de antialiasing no es un desborde.
      if (caja.right > limite.right + 1 || caja.left < limite.left - 1) {
        const clase = el.className.toString().split(' ').slice(0, 3).join('.')
        culpables.push(`${el.tagName.toLowerCase()}.${clase} (${Math.round(caja.left)}→${Math.round(caja.right)})`)
      }
      if (culpables.length >= 5) break
    }
    // Cuántos miró de verdad, para no pasar sobre cero: si el selector dejara de
    // encontrar nada —una clase renombrada, un marco que no montó— el barrido
    // daría «sin culpables» sin haber mirado un solo elemento.
    return { culpables, examinados }
  })
}
