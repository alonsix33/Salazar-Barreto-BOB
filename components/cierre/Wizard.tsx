'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { COPYS } from '@/lib/copys'
import { capitalizar } from '@/lib/formato'
import type { Borrador } from '@/lib/datos/meses'
import type { Extra, MesId } from '@/lib/calculo/tipos'
import { Hoja } from '@/components/hojas/Hoja'
import { useHoja } from '@/components/hojas/Hojas'
import { Paso0 } from './Paso0'
import { Paso1Lecturas } from './Paso1Lecturas'
import { Paso2Agua } from './Paso2Agua'
import { Paso3Luz } from './Paso3Luz'
import { Paso4Fijos } from './Paso4Fijos'
import { Paso5Puntual } from './Paso5Puntual'
import { Paso6Revision } from './Paso6Revision'
import { Paso7Publicar } from './Paso7Publicar'
import { Publicado } from './Publicado'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * El cierre del mes. `04-cierre-del-mes.md`.
 *
 * El flujo más importante de la app: lo hace una persona, una vez al mes, y de
 * él dependen las cuotas de siete hogares. El objetivo de diseño fue explícito:
 * **que sea imposible equivocarse.**
 *
 * Principios que gobiernan el componente entero:
 *
 *  - **Un dato por pantalla.** Nunca un formulario con ocho campos.
 *  - **Se guarda solo en cada paso**, en el servidor. Se puede salir y volver, y
 *    desde otro teléfono: por eso el paso vive en la base y no en el navegador.
 *  - **El botón de avanzar dice qué falta**, en vez de ponerse gris y callarse.
 *  - **Nada se publica hasta el paso 7.** Antes de eso ningún vecino ve nada, y
 *    por eso ninguna escritura de los pasos 1 a 6 genera un aviso.
 */

const CLAVE = ['borrador'] as const

export function Wizard({ mes }: { mes: MesId }) {
  const { cerrar } = useHoja()
  const router = useRouter()
  const cola = useQueryClient()
  const [publicado, setPublicado] = useState<{ total: number } | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...CLAVE, mes],
    queryFn: async (): Promise<Borrador> => {
      const r = await fetch(`/api/meses/${mes}/borrador`)
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo abrir el cierre')
      return cuerpo
    },
  })

  const refrescar = useCallback(() => {
    void cola.invalidateQueries({ queryKey: [...CLAVE, mes] })
  }, [cola, mes])

  /** Guarda en el servidor y refresca. Cada paso llama a esto al confirmar. */
  const guardar = useMutation({
    mutationFn: async ({ ruta, cuerpo }: { ruta: string; cuerpo: unknown }) => {
      const r = await fetch(`/api/meses/${mes}/${ruta}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...(cuerpo as object), version: data?.version }),
      })
      const respuesta = await r.json()
      if (!r.ok) throw new Error(respuesta.error ?? 'No se pudo guardar')
      return respuesta
    },
    onSuccess: refrescar,
  })

  const irAPaso = useMutation({
    mutationFn: async (paso: number) => {
      await fetch(`/api/meses/${mes}/paso`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paso }),
      })
      return paso
    },
    onSuccess: refrescar,
  })

  const paso = data?.paso ?? 0
  const titulo = useMemo(
    () => (paso === 0 ? (data?.etiqueta ?? '') : COPYS.cierre.paso(paso)),
    [paso, data?.etiqueta],
  )

  if (isLoading) {
    return (
      <Hoja titulo="Cerrar el mes" altura="alta">
        <div className="hoja-cuerpo">
          <p className="tipo-cuerpo-menor text-gris">Abriendo el cierre…</p>
        </div>
      </Hoja>
    )
  }
  if (isError || !data) {
    return (
      <Hoja titulo="Cerrar el mes" altura="alta">
        <div className="hoja-cuerpo">
          <p className="tipo-cuerpo-menor text-gris">
            {mensajeDeError(error, 'No se pudo abrir el cierre.')}
          </p>
        </div>
      </Hoja>
    )
  }

  if (publicado) {
    return (
      <Publicado
        mes={data.etiqueta}
        total={publicado.total}
        cuadra={data.resultado.cuadra}
        onVolver={() => {
          cerrar()
          router.refresh()
        }}
      />
    )
  }

  const nombreCorto = data.etiqueta.split(' ')[0]!.toLowerCase()
  const comun = {
    borrador: data,
    guardar: (ruta: string, cuerpo: unknown) => guardar.mutateAsync({ ruta, cuerpo }),
    guardando: guardar.isPending,
    errorGuardar: guardar.error ? mensajeDeError(guardar.error) : null,
    avanzar: () => irAPaso.mutate(paso + 1),
    nombreMes: nombreCorto,
  }

  return (
    <Hoja titulo={`Cerrar ${nombreCorto}`} altura="alta">
      <header className="cierre-cabecera">
        <button
          type="button"
          onClick={() => (paso === 0 ? cerrar() : irAPaso.mutate(paso - 1))}
          className="circulo-atras"
          aria-label={paso === 0 ? 'Cerrar' : 'Volver al paso anterior'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="tipo-etiqueta-seccion text-gris">
          {paso === 0 ? data.etiqueta : COPYS.cierre.paso(paso)}
        </span>
        <span className="cierre-hueco" aria-hidden="true" />
      </header>

      {paso > 0 && (
        <div className="cierre-progreso" role="progressbar" aria-valuemin={1} aria-valuemax={7} aria-valuenow={paso} aria-label={titulo}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span
              key={n}
              className={`cierre-tramo ${n < paso ? 'cierre-tramo-hecho' : n === paso ? 'cierre-tramo-actual' : ''}`}
            />
          ))}
        </div>
      )}

      {paso === 0 && <Paso0 {...comun} />}
      {paso === 1 && <Paso1Lecturas {...comun} />}
      {paso === 2 && <Paso2Agua {...comun} />}
      {paso === 3 && <Paso3Luz {...comun} />}
      {paso === 4 && <Paso4Fijos {...comun} />}
      {paso === 5 && <Paso5Puntual {...comun} />}
      {paso === 6 && <Paso6Revision {...comun} />}
      {paso === 7 && (
        <Paso7Publicar
          {...comun}
          onPublicado={(total: number) => setPublicado({ total })}
        />
      )}
    </Hoja>
  )
}

/** Lo que todos los pasos reciben. */
export interface PropsPaso {
  borrador: Borrador
  guardar: (ruta: string, cuerpo: unknown) => Promise<unknown>
  guardando: boolean
  errorGuardar: string | null
  avanzar: () => void
  nombreMes: string
}

export { capitalizar }
export type { Extra }
