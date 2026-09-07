'use client'

import { useEffect } from 'react'
import { COLOR_GRIS, COLOR_NOCHE, COLOR_TEMA, COLOR_TINTA } from '@/lib/tema'

/**
 * El error que se lleva por delante hasta el layout.
 *
 * Este componente **reemplaza el `<html>` entero**, así que no puede usar nada
 * del layout: ni las fuentes, ni los tokens de `globals.css`, ni `COPYS`. Es el
 * único sitio del proyecto donde una medida va escrita a mano, y es a la fuerza:
 * si `globals.css` es lo que ha fallado, importarlo aquí falla otra vez.
 *
 * **Los colores sí salen de `lib/tema.ts`**, que es la puerta por la que un color
 * puede vivir fuera del CSS y tiene un test comparándolo con los tokens. Lo
 * único exento en `verificar-tokens` son los píxeles, y está declarado allí con
 * este motivo.
 *
 * Por eso es feo y corto. Existe para que nadie vea una pantalla en blanco.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Fallo total de la aplicación:', error)
  }, [error])

  return (
    <html lang="es-PE">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: COLOR_TEMA,
          color: COLOR_TINTA,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>Algo no está respondiendo</h1>
          <p style={{ fontSize: '14px', color: COLOR_GRIS, margin: '0 0 20px', maxWidth: '320px' }}>
            La app no pudo cargar. No se ha perdido nada: todo lo que estaba guardado sigue
            guardado.
          </p>
          <p style={{ fontSize: '14px', color: COLOR_GRIS, margin: '0 0 20px', maxWidth: '320px' }}>
            Vuelve a intentarlo en un momento. Si sigue igual, avisa a quien administra.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '48px',
              padding: '0 24px',
              borderRadius: '999px',
              border: 'none',
              background: COLOR_NOCHE,
              color: COLOR_TEMA,
              fontSize: '15px',
            }}
          >
            Volver a intentarlo
          </button>
        </div>
      </body>
    </html>
  )
}
