'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import type { MesId } from '@/lib/calculo/tipos'
import type { ResumenMes } from '@/lib/datos/meses'

/**
 * El carrusel de meses de P2. `03-pantallas.md`.
 *
 * Se autocentra en el mes activo al abrir: con doce meses, el que te interesa
 * puede quedar fuera de pantalla y nadie va a deslizar a ciegas.
 */
export function SelectorMeses({ meses, activo }: { meses: readonly ResumenMes[]; activo: MesId }) {
  const tira = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const contenedor = tira.current
    const seleccionado = contenedor?.querySelector<HTMLElement>('[data-activo="si"]')
    if (!contenedor || !seleccionado) return
    const fin = seleccionado.offsetLeft + seleccionado.offsetWidth + 24
    if (fin > contenedor.scrollLeft + contenedor.clientWidth) {
      contenedor.scrollLeft = fin - contenedor.clientWidth
    } else if (seleccionado.offsetLeft < contenedor.scrollLeft) {
      contenedor.scrollLeft = Math.max(0, seleccionado.offsetLeft - 24)
    }
  }, [activo])

  return (
    <div ref={tira} data-scroll-x=""
      className="scroll-limpio selector-meses" role="tablist" aria-label="Elegir mes">
      {meses.map((m) => {
        const esActivo = m.mes === activo
        return (
          <Link
            key={m.mes}
            href={`/mes/${m.mes}`}
            role="tab"
            aria-selected={esActivo}
            data-activo={esActivo ? 'si' : 'no'}
            className={`selector-mes ${esActivo ? 'selector-mes-activo' : 'selector-mes-inactivo'}`}
          >
            {m.corto}
          </Link>
        )
      })}
    </div>
  )
}
