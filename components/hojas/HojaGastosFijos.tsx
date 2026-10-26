'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { COPYS } from '@/lib/copys'
import { nombreMes } from '@/lib/calculo/mes'
import type { MesId } from '@/lib/calculo/tipos'
import { FilaFijo } from '@/components/cierre/FilaFijo'
import { NuevoFijo } from '@/components/cierre/NuevoFijo'
import { Hoja } from './Hoja'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * `gastos-fijos` · Lo que se cobra todos los meses: **añadir**, cambiar el monto,
 * marcar como anual, apagar y volver a encender.
 *
 * Antes solo se podía apagar y encender, y el panel decía «se editan desde el
 * paso 4 del cierre»: agregar un gasto fijo exigía estar en mitad de un cierre.
 * La interfaz prometía una administración que no daba.
 *
 * Un cambio aplica **desde el mes que se está cerrando** y no reescribe el
 * pasado: los meses publicados no se tocan. Para un gasto que llegó a un mes ya
 * cerrado, o para cambiar solo ese mes, está *Corregir un mes publicado*. Cada
 * cambio avisa a los siete, porque cambia lo que pagan.
 *
 * Lista los dos estados —activos y apagados—: un concepto apagado no aparece en
 * el cierre, así que aquí es el único sitio donde se puede reactivar.
 */
export function HojaGastosFijos({
  gastosFijos,
  vigenteDesde,
}: {
  gastosFijos: { concepto: string; monto: number | null; anual: boolean; activo: boolean }[]
  vigenteDesde: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const desde = nombreMes(vigenteDesde as MesId)

  const cambiar = useMutation({
    mutationFn: async (cambio: { concepto: string; monto: number | null; anual?: boolean; activo?: boolean }) => {
      const r = await fetch('/api/gastos-fijos', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cambios: [cambio], vigenteDesde }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo guardar')
      return cuerpo
    },
    onSuccess: () => {
      router.refresh()
      // `router.refresh()` re-pinta el panel de siempre, que recibe sus datos
      // como prop de un Server Component, pero esta hoja los trae aparte con
      // `useQuery(['admin'], …)` en `HojaAdminDatos` — la misma trampa que ya
      // documentó `RegistrarPago.tsx`. Sin esto, la fila quedaba mintiendo
      // hasta que expiraba el `staleTime`.
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  return (
    <Hoja titulo={COPYS.gastosFijos.titulo} altura="alta">
      <div className="hoja-cuerpo">
        <h2 className="tipo-titulo-hoja pagar-titulo">{COPYS.gastosFijos.titulo}</h2>
        <p className="tipo-cuerpo-chico text-gris pagar-intro">{COPYS.gastosFijos.intro(desde)}</p>

        {gastosFijos.map((g) =>
          g.activo ? (
            <FilaFijo
              // La `key` lleva el monto: tras guardar, la fila se rehace con lo
              // que quedó escrito y no con lo que tenía abierto.
              key={`${g.concepto}:${g.monto}:${g.anual}`}
              concepto={g.concepto}
              monto={g.monto}
              anual={g.anual}
              porConfirmar={g.monto === null}
              onMonto={(v) => cambiar.mutate({ concepto: g.concepto, monto: v })}
              onAnual={(anual) => cambiar.mutate({ concepto: g.concepto, monto: g.monto, anual })}
              onDesactivar={() => cambiar.mutate({ concepto: g.concepto, monto: g.monto, activo: false })}
            />
          ) : (
            <div key={g.concepto} className="admin-fila admin-fila-inactiva">
              <span className="tipo-cuerpo-medio flex min-w-0 flex-1 flex-col">
                <span className="truncate">{g.concepto}</span>
                <span className="tipo-contexto-chico text-gris">{COPYS.gastosFijos.apagado}</span>
              </span>
              <button
                type="button"
                disabled={cambiar.isPending}
                onClick={() => cambiar.mutate({ concepto: g.concepto, monto: g.monto, activo: true })}
                className="fijo-nuevo-boton fijo-fila-toggle"
              >
                {COPYS.cierre.conceptoActivar}
              </button>
            </div>
          ),
        )}

        <NuevoFijo
          existentes={gastosFijos.map((g) => g.concepto)}
          onGuardar={(n) => cambiar.mutate(n)}
        />

        {cambiar.isError && <Fallo>{mensajeDeError(cambiar.error)}</Fallo>}
      </div>
    </Hoja>
  )
}
