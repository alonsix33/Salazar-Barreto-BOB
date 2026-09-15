'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { Hoja } from './Hoja'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * `gastos-fijos` · Activar y desactivar un gasto fijo. `04` y el pedido de
 * poder apagar un concepto sin borrar su historia.
 *
 * El paso 4 del cierre solo enseña los gastos **activos** del mes que se está
 * cerrando —para eso está, para cerrar ese mes—, así que un concepto que ya se
 * desactivó no tiene dónde reaparecer para reactivarlo. Esta hoja lista los
 * dos estados: todo lo que alguna vez se configuró, activo o no.
 */
export function HojaGastosFijos({
  gastosFijos,
  vigenteDesde,
}: {
  gastosFijos: { concepto: string; monto: number | null; anual: boolean; activo: boolean }[]
  vigenteDesde: string
}) {
  const router = useRouter()

  const cambiar = useMutation({
    mutationFn: async (cambio: { concepto: string; monto: number | null; activo: boolean }) => {
      const r = await fetch('/api/gastos-fijos', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cambios: [cambio], vigenteDesde }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo guardar')
      return cuerpo
    },
    onSuccess: () => router.refresh(),
  })

  return (
    <Hoja titulo="Gastos fijos del edificio">
      <div className="hoja-cuerpo">
        <h2 className="tipo-titulo-hoja pagar-titulo">Gastos fijos del edificio</h2>
        <p className="tipo-cuerpo-chico text-gris pagar-intro">
          Un cambio aplica desde el mes que se está cerrando. Los meses ya publicados no se tocan.
        </p>

        {gastosFijos.map((g) => (
          <div key={g.concepto} className={g.activo ? 'admin-fila' : 'admin-fila admin-fila-inactiva'}>
            <span className="tipo-cuerpo-medio flex min-w-0 flex-1 flex-col">
              <span className="truncate">{g.concepto}</span>
              <span className="flex items-center gap-etiqueta tipo-contexto-chico text-gris">
                {g.monto === null ? 'por confirmar' : `S/ ${fmt(g.monto)}`}
                {g.anual && <span className="tipo-etiqueta-anual etiqueta-anual">{COPYS.mes.anual}</span>}
                {!g.activo && <span>inactivo</span>}
              </span>
            </span>
            <button
              type="button"
              disabled={cambiar.isPending}
              onClick={() => cambiar.mutate({ concepto: g.concepto, monto: g.monto, activo: !g.activo })}
              className="fijo-nuevo-boton fijo-fila-toggle"
            >
              {g.activo ? COPYS.cierre.conceptoDesactivar : COPYS.cierre.conceptoActivar}
            </button>
          </div>
        ))}

        {cambiar.isError && <Fallo>{mensajeDeError(cambiar.error)}</Fallo>}
      </div>
    </Hoja>
  )
}
