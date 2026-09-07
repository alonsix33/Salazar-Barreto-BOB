import type { EstadoCuota } from '@/lib/estados'

/**
 * La barra de siete tramos. `02` §4.5.
 *
 * Cuenta la historia "5 de 7" antes de que nadie lea la lista. Verde los
 * confirmados, celeste los que avisaron, ámbar suave los que no.
 */

const COLOR: Record<EstadoCuota, string> = {
  'al-dia': 'bg-verde',
  'en-verificacion': 'bg-agua',
  'sin-registrar': 'bg-ambar-punto',
}

export function BarraSegmentada({
  estados,
  resumen,
}: {
  estados: readonly EstadoCuota[]
  /** Lo que un lector de pantalla oye en vez de siete rectángulos. */
  resumen: string
}) {
  return (
    <div className="flex gap-segmentos" role="img" aria-label={resumen}>
      {estados.map((estado, i) => (
        <span key={i} className={`segmento ${COLOR[estado]}`} />
      ))}
    </div>
  )
}
