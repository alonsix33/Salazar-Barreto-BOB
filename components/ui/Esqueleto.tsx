/**
 * El esqueleto que se ve mientras una pantalla trae sus datos.
 *
 * Existe porque cambiar de pestaña **no puede parecer que la app se colgó**. Sin
 * esto, Next espera a que el servidor termine y el teléfono se queda con la
 * pantalla anterior congelada: el vecino toca otra vez, y otra. Con esto la
 * pestaña cambia al instante y el contenido entra cuando llega.
 *
 * Tres decisiones, y las tres son de honestidad:
 *
 *  - **No pinta cifras falsas.** Son bloques grises, no números de ejemplo ni
 *    ceros. Un cero que en realidad significa «todavía no lo sé» es la clase de
 *    dato inventado que `05` prohíbe, y en una app de dinero se lee como saldo.
 *  - **Lo dice con palabras**, no solo con bloques: un lector de pantalla no ve
 *    un rectángulo gris. De ahí el `role="status"` y el texto para lectores.
 *  - **Se queda quieto si el sistema lo pide.** Con `prefers-reduced-motion` no
 *    late: se ve el mismo gris, sin animación.
 */
export function Esqueleto({ filas = 4, conNav = true }: { filas?: number; conNav?: boolean }) {
  return (
    <div
      className={`pantalla scroll-limpio${conNav ? ' con-nav' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando…</span>
      <div className="esqueleto-cabecera">
        <span className="esqueleto-bloque esqueleto-titulo" />
        <span className="esqueleto-bloque esqueleto-subtitulo" />
      </div>
      <span className="esqueleto-bloque esqueleto-tarjeta" />
      <div className="esqueleto-lista">
        {Array.from({ length: filas }, (_, i) => (
          <span key={i} className="esqueleto-bloque esqueleto-fila" />
        ))}
      </div>
    </div>
  )
}
