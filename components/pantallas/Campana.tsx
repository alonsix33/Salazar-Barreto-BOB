'use client'

import Link from 'next/link'

/**
 * La campana de la cabecera de Inicio.
 *
 * El punto terracota aparece si hay avisos sin leer. Va con `aria-label` que
 * dice cuántos: un punto de color no le dice nada a quien no lo ve.
 */
export function Campana({ sinLeer }: { sinLeer: number }) {
  return (
    <Link
      href="/avisos"
      className="campana"
      aria-label={sinLeer > 0 ? `Avisos · ${sinLeer} sin leer` : 'Avisos'}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {sinLeer > 0 && <span className="campana-punto" aria-hidden="true" />}
    </Link>
  )
}
