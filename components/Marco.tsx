import type { ReactNode } from 'react'

/**
 * El contenedor de la aplicación.
 *
 * **El marco de teléfono del prototipo no existe aquí, en ningún ancho.**
 * `02-sistema-de-diseno.md` §7 pedía uno —390×844, con sombra— para tablet y
 * escritorio; se cambió a pedido explícito: la app tiene que verse bien desde
 * un teléfono chico hasta un iPad Mini en vertical, con el ancho creciendo de
 * forma fluida y sin saltar a una tarjeta flotante en el medio de la
 * pantalla. `.marco-app` (`app/globals.css`) es `100vw` topado en
 * `--spacing-app-tablet` (768px): por debajo de eso, edge-to-edge como
 * siempre; por encima —una ventana de escritorio de verdad, fuera de
 * alcance—, se queda centrado y capado en vez de estirarse sin límite.
 *
 * Una pantalla baja (`max-height: 560px`, típicamente un teléfono girado) sigue
 * siendo una columna de `min(430px, 100vw)`: eso no cambió.
 *
 * No hay layout de escritorio de dos columnas. Decisión tomada con el cliente:
 * son siete vecinos consultando su cuota desde el celular o la tablet, en
 * vertical.
 */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="marco-exterior">
      <div className="marco-app" id="marco-app">{children}</div>
    </div>
  )
}
