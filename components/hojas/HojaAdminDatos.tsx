'use client'

import { useQuery } from '@tanstack/react-query'
import { COPYS } from '@/lib/copys'
import type { DatosAdmin } from '@/lib/datos/admin'
import { Hoja } from './Hoja'
import { HojaCargos } from './HojaCargos'
import { HojaExport } from './HojaExport'
import { HojaCorregir } from './HojaCorregir'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * Carga lo que necesitan las dos hojas del panel que dependen de la base.
 *
 * **Tres estados, no dos.** *Cargando*, *error* y *listo* se dicen distinto.
 * Con `isLoading || !data` en una sola rama, un fallo dejaba la hoja diciendo
 * «Cargando…» para siempre: en TanStack Query v5, al agotarse el reintento
 * `isLoading` pasa a `false` y `data` sigue `undefined`, así que la guarda caía
 * igual en la rama de carga. Un PIN caducado o un 500 se veían como un giro sin
 * fin y sin una palabra.
 */
export function HojaAdminDatos({ modo }: { modo: 'export' | 'cargos' | 'corregir' }) {
  const titulo =
    modo === 'export'
      ? 'Exportar el año'
      : modo === 'cargos'
        ? 'Cargos y créditos'
        : 'Corregir un mes publicado'
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin'],
    queryFn: async (): Promise<DatosAdmin> => {
      const r = await fetch('/api/admin/panel')
      // El 401 se distingue: no es que la app falle, es que hay que volver a
      // entrar con el PIN, y decirlo ahorra una llamada al vecino que administra.
      if (r.status === 401) throw new Error(COPYS.error.sesionCaducada)
      if (!r.ok) throw new Error(COPYS.error.noSePudo)
      return r.json()
    },
  })

  if (isPending) {
    return (
      <Hoja titulo={titulo}>
        <div className="hoja-cuerpo">
          <p className="tipo-cuerpo-menor text-gris">Cargando…</p>
        </div>
      </Hoja>
    )
  }

  if (isError || !data) {
    return (
      <Hoja titulo={titulo}>
        <div className="hoja-cuerpo">
          <Fallo>{error ? mensajeDeError(error) : COPYS.error.noSePudo}</Fallo>
          <button type="button" onClick={() => void refetch()} className="cierre-boton">
            {COPYS.error.reintentar}
          </button>
        </div>
      </Hoja>
    )
  }

  if (modo === 'export') return <HojaExport anios={data.anios} />
  if (modo === 'cargos') return <HojaCargos lavado={data.lavado} />
  return <HojaCorregir publicados={data.publicados} />
}
