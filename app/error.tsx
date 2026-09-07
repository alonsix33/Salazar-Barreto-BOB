'use client'

import { useEffect } from 'react'
import { COPYS } from '@/lib/copys'

/**
 * La pantalla cuando algo revienta por debajo. Fase 7, punto 4 del verificador:
 * *«rompe la conexión a la base a propósito, ¿la app da un error claro o una
 * pantalla en blanco?»*
 *
 * Sin este fichero, Next enseña su propia página de error —«Application error: a
 * server-side exception has occurred»— que para siete vecinos que solo querían
 * ver su cuota no significa nada.
 *
 * **No se enseña el error técnico.** El mensaje del servidor puede llevar la
 * cadena de conexión, el nombre de una tabla o la ruta de un fichero. Va a la
 * consola, que es donde sirve, y a la pantalla va lo que el vecino necesita
 * saber: que no se ha perdido nada y qué hacer.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Fallo de la aplicación:', error)
  }, [error])

  return (
    <div className="pantalla pantalla-error">
      <div className="pantalla-error-caja">
        <h1 className="tipo-titulo-pantalla">{COPYS.error.pantallaTitulo}</h1>
        <p className="tipo-cuerpo-chico text-gris pantalla-error-texto">
          {COPYS.error.pantallaTexto}
        </p>
        <p className="tipo-cuerpo-chico text-gris pantalla-error-texto">
          {COPYS.error.pantallaQueHacer}
        </p>
        <button type="button" onClick={reset} className="cierre-boton">
          {COPYS.error.reintentarPantalla}
        </button>
        {/* El identificador que Next asigna al fallo. No es para el vecino: es
            para que quien administra pueda decir "salió el error tal" y que se
            pueda encontrar en los registros del servidor. */}
        {error.digest && (
          <p className="tipo-contexto-mini text-gris-claro pantalla-error-digest">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
