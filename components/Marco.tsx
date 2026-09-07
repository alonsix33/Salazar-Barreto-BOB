import type { ReactNode } from 'react'

/**
 * El contenedor de la aplicación. `02-sistema-de-diseno.md` §7.
 *
 * **El marco de teléfono del prototipo no existe aquí.** Aquel se dibujaba en
 * 390×844 con sombra porque tenía que verse en un navegador de escritorio. En
 * producción: en un teléfono la app ocupa la pantalla; en una pantalla baja es
 * una columna de `min(430px, 100vw)`; y solo en tablet y escritorio aparece el
 * marco centrado, topado para que nunca se recorte.
 *
 * No hay layout de escritorio de dos columnas. Decisión tomada con el cliente:
 * son siete vecinos consultando su cuota desde el celular.
 */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="marco-exterior">
      <div className="marco-app" id="marco-app">{children}</div>
    </div>
  )
}
