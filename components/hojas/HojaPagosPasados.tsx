'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DPTOS } from '@/lib/calculo/constantes'
import { etiquetaMes } from '@/lib/calculo/mes'
import type { MesId, PagosMes, ResultadoMes } from '@/lib/calculo/tipos'
import type { FilaPago } from '@/lib/datos/admin'
import { COPYS } from '@/lib/copys'
import { RegistrarPago } from '@/components/pantallas/RegistrarPago'
import { Hoja } from './Hoja'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * Confirmar pagos de cualquier mes publicado, no solo el último.
 *
 * Antes, `RegistrarPago` en el panel solo se montaba con `datos.mesPublicado`
 * —el último—: quien administra no tenía forma de confirmar un pago de un mes
 * anterior que se le hubiera pasado, aunque `confirmarPago` (el servicio) ya
 * aceptaba cualquier mes. Faltaba solo esta hoja.
 *
 * Mismo patrón que `HojaCorregir`: una tira de meses publicados, y
 * `/api/meses/[mes]` trae el `ResultadoMes` y los `pagos` de cualquiera de
 * ellos. La fila por departamento se arma aquí con los mismos seis campos que
 * usa `panelDeAdmin()` para el mes actual —no hay una segunda regla de
 * negocio que duplicar, es solo qué mostrar de datos que ya llegaron.
 */
export function HojaPagosPasados({
  publicados,
}: {
  publicados: readonly { mes: MesId; etiqueta: string }[]
}) {
  const [mes, setMes] = useState<MesId>(publicados[0]?.mes ?? ('2026-01' as MesId))

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['mes', mes],
    queryFn: async (): Promise<{ resultado: ResultadoMes; pagos: PagosMes }> => {
      const r = await fetch(`/api/meses/${mes}`)
      if (!r.ok) throw new Error('No se pudo cargar el mes')
      return r.json()
    },
  })

  const filas: FilaPago[] | null =
    data?.resultado.valido
      ? DPTOS.map((d) => {
          const p = data.pagos[d.id] ?? null
          return {
            dpto: d.id,
            nombre: d.nombre,
            cuota: data.resultado.cuotas[d.id].total,
            estado: p?.estado ?? null,
            fecha: p?.fecha ?? null,
            operacion: p?.op ?? null,
            texto: p?.texto ?? null,
          }
        })
      : null

  return (
    <Hoja titulo={COPYS.pagos.confirmarPasados} altura="alta">
      <div className="hoja-cuerpo">
        <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.pagos.confirmarPasados}</h2>
        <p className="tipo-cuerpo-chico text-gris cierre-intro">
          {COPYS.pagos.confirmarPasadosIntro(etiquetaMes(mes))}
        </p>

        {publicados.length > 1 && (
          <div className="correccion-meses" data-scroll-x>
            {publicados.map((p) => (
              <button
                key={p.mes}
                type="button"
                aria-pressed={p.mes === mes}
                onClick={() => setMes(p.mes)}
                className={`tipo-contexto ${p.mes === mes ? 'correccion-mes correccion-mes-activo' : 'correccion-mes'}`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        )}

        {isPending && <p className="tipo-cuerpo-menor text-gris">Cargando…</p>}
        {isError && (
          <>
            <Fallo>{mensajeDeError(error)}</Fallo>
            <button type="button" onClick={() => void refetch()} className="cierre-boton">
              {COPYS.error.reintentar}
            </button>
          </>
        )}
        {/*
          Un mes publicado siempre debería traer un `ResultadoMes` válido —
          publicar exige tener el recibo y las lecturas—, pero sin esta rama
          un `valido: false` inesperado dejaba un hueco en blanco debajo de la
          tira de meses: ni carga, ni error, ni filas, nada que explique por
          qué no hay nada que confirmar. `noSePudo` de `HojaCorregir` tiene el
          mismo cuidado para el mismo dato.
        */}
        {!isPending && !isError && data && !data.resultado.valido && (
          <Fallo>{data.resultado.motivoInvalido ?? COPYS.error.noSePudo}</Fallo>
        )}
        {filas?.map((p) => <RegistrarPago key={p.dpto} pago={p} mes={mes} />)}
      </div>
    </Hoja>
  )
}
