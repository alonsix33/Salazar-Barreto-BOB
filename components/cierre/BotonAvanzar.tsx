'use client'

/**
 * El botón de avanzar del cierre. `04` §5.
 *
 * **Cuando no se puede avanzar, dice qué falta.** No se pone gris y se calla:
 * un botón gris sin explicación deja al administrador mirando la pantalla sin
 * saber qué hacer, y esto lo hace una persona sola, una vez al mes.
 *
 * El tipo lo obliga: si `bloqueadoPor` viene, el botón muestra ese texto.
 */
export function BotonAvanzar({
  children,
  onClick,
  bloqueadoPor,
  cargando = false,
}: {
  children: string
  onClick: () => void
  /** Qué falta. Si viene, el botón no avanza y muestra este texto. */
  bloqueadoPor?: string | null
  cargando?: boolean
}) {
  const bloqueado = Boolean(bloqueadoPor)
  return (
    <button
      type="button"
      onClick={bloqueado || cargando ? undefined : onClick}
      aria-disabled={bloqueado || cargando}
      className={bloqueado ? 'cierre-boton cierre-boton-bloqueado' : 'cierre-boton'}
    >
      {cargando ? 'Guardando…' : (bloqueadoPor ?? children)}
    </button>
  )
}
