'use client'

import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import type { DptoId, MesId } from '@/lib/calculo/tipos'

/**
 * El mes y el departamento que la pantalla de fondo está mirando.
 *
 * Las hojas viven al final del marco, por encima de todo, así que están fuera
 * del árbol de la pantalla y necesitan saber sobre qué se abrieron. Abrir una
 * hoja no cambia la pantalla de fondo, y cerrarla vuelve exactamente a donde
 * estabas (`README` §6).
 *
 * Cada pantalla monta un `<FijarContexto>` con lo suyo.
 */

interface Valor {
  mes: MesId | null
  dpto: DptoId | null
  fijar: (v: { mes: MesId | null; dpto: DptoId | null }) => void
}

const Ctx = createContext<Valor>({ mes: null, dpto: null, fijar: () => {} })

export function useContexto(): { mes: MesId | null; dpto: DptoId | null } {
  const { mes, dpto } = useContext(Ctx)
  return { mes, dpto }
}

export function ProveedorContexto({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ mes: MesId | null; dpto: DptoId | null }>({ mes: null, dpto: null })
  const valor = useMemo(() => ({ ...estado, fijar: setEstado }), [estado])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

/** Lo monta cada pantalla para decir sobre qué mes y qué departamento está. */
export function FijarContexto({ mes, dpto }: { mes: MesId | null; dpto: DptoId | null }) {
  const { fijar } = useContext(Ctx)
  useEffect(() => {
    fijar({ mes, dpto })
  }, [mes, dpto, fijar])
  return null
}
