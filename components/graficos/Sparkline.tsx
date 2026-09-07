import { fmt } from '@/lib/calculo/redondeo'

/**
 * La curva del saldo. `02` §4.4.
 *
 * SVG a mano, cuarenta líneas. Sin ejes ni cuadrícula: es una forma, no una
 * tabla. Con menos de tres puntos no se dibuja nada y se dice por qué, en vez
 * de pintar una recta que no significa nada.
 */
export function Sparkline({
  puntos,
  grande = false,
  vacio,
  titulo,
}: {
  puntos: readonly number[]
  grande?: boolean
  /** Qué decir cuando todavía no hay curva. */
  vacio: string
  titulo: string
}) {
  if (puntos.length < 3) {
    return (
      <div className="sparkline-vacia tipo-contexto-chico text-gris-claro">{vacio}</div>
    )
  }
  const alto = grande ? 70 : 44
  const maximo = Math.max(...puntos)
  const minimo = Math.min(...puntos)
  const rango = maximo - minimo || 1
  const coordenada = (v: number, i: number) =>
    `${(i / (puntos.length - 1)) * 300},${alto - 6 - ((v - minimo) / rango) * (alto - 14)}`
  const linea = puntos.map(coordenada).join(' ')
  const ultimo = coordenada(puntos[puntos.length - 1]!, puntos.length - 1).split(',')

  return (
    <svg
      viewBox={`0 0 300 ${alto}`}
      preserveAspectRatio="none"
      className={grande ? 'sparkline sparkline-grande' : 'sparkline'}
      role="img"
      aria-label={`${titulo}. Del más antiguo al más reciente: ${puntos.map((p) => fmt(p)).join(', ')}.`}
    >
      <polyline
        points={linea}
        fill="none"
        stroke="currentColor"
        strokeWidth={grande ? 2.2 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {grande && <circle cx={ultimo[0]} cy={ultimo[1]} r={3.5} fill="currentColor" />}
    </svg>
  )
}
