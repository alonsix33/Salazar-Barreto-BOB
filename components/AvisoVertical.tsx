import { COPYS } from '@/lib/copys'

/**
 * Cubre la pantalla entera cuando el teléfono está en horizontal.
 *
 * La app decidió quedarse en vertical —el teclado numérico, la navegación
 * inferior y las hojas están medidos para ese ancho, no para uno panorámico—
 * y `orientation: 'portrait'` en el manifiesto lo pide al sistema. Pero eso
 * **no alcanza**: solo lo respeta una PWA instalada en Android, no una
 * pestaña de navegador ni casi ningún caso en iOS, donde Safari no expone
 * forma de bloquear la orientación de una app de escritorio de inicio.
 *
 * Por eso la defensa de verdad es CSS puro, no JavaScript: `@media
 * (orientation: landscape)` no depende de que ninguna API exista ni de que
 * un efecto llegue a correr, y tapa la interfaz descuadrada con un mensaje
 * en vez de dejarla ver así. `useBloqueoDeOrientacion` (`lib/orientacion.ts`)
 * es el intento adicional, mejor esfuerzo, para cuando sí hay soporte.
 */
export function AvisoVertical() {
  return (
    <div className="aviso-vertical" role="alert">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M12 18h.01" />
        <path d="M3 3l3 2M3 3l2 3" />
      </svg>
      <p className="tipo-titulo-hoja aviso-vertical-titulo">{COPYS.giraElTelefono.titulo}</p>
      <p className="tipo-cuerpo-chico text-gris aviso-vertical-texto">{COPYS.giraElTelefono.texto}</p>
    </div>
  )
}
