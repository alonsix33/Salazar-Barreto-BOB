'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from './Avatar'
import { useHoja } from './hojas/Hojas'

/**
 * La navegación inferior. `02` §4.7.
 *
 * Píldora noche de 62px con cuatro destinos, y **separado por 10px**, el círculo
 * de Bob. Bob no es un quinto destino: es una acción, y por eso está fuera de la
 * píldora.
 *
 * Son enlaces de verdad (`<Link>`), no `div` con `onClick`: así el botón atrás
 * del sistema funciona y se puede tabular.
 */

const DESTINOS = [
  { href: '/', etiqueta: 'Inicio', icono: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'] },
  {
    href: '/mes',
    etiqueta: 'El mes',
    icono: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18M8 3v4M16 3v4'],
  },
  { href: '/mi-departamento', etiqueta: 'Mi departamento', icono: ['M5 21V6l7-3 7 3v15', 'M9 21v-5h6v5'] },
  { href: '/historial', etiqueta: 'Historial', icono: ['M4 19V9M10 19V5M16 19v-6M22 19h-20'] },
] as const

export function NavInferior() {
  const ruta = usePathname()
  const { abrir } = useHoja()

  return (
    <nav className="nav-inferior" aria-label="Navegación principal">
      <div className="nav-pildora">
        {DESTINOS.map((d) => {
          const activo = d.href === '/' ? ruta === '/' : ruta.startsWith(d.href)
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-label={d.etiqueta}
              aria-current={activo ? 'page' : undefined}
              className={`nav-destino ${activo ? 'bg-sobre-noche-activo' : ''}`}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={activo ? 'text-sobre-noche' : 'text-sobre-noche-terciario'}
                aria-hidden="true"
              >
                {d.icono.map((p, i) => (
                  <path key={i} d={p} />
                ))}
              </svg>
            </Link>
          )
        })}
      </div>
      <button type="button" onClick={() => abrir('bob')} className="nav-bob" aria-label="Preguntar a Bob">
        <Avatar tamano="nav" invertido />
      </button>
    </nav>
  )
}
