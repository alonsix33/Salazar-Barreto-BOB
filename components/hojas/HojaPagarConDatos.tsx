'use client'

import { useQuery } from '@tanstack/react-query'
import type { DptoId, MesId, Pago, ResultadoMes } from '@/lib/calculo/tipos'
import { HojaPagar } from './HojaPagar'
import { Hoja } from './Hoja'

/**
 * Carga lo que la hoja de pago necesita: el monto exacto de este mes, los
 * datos de la cuenta, y **el pago que ya exista** para este mes+dpto. Se pide
 * al abrir, no en cada carga de pantalla.
 *
 * El `pago` es lo que faltaba antes: `/api/meses/[mes]` siempre lo trajo (lo
 * usa Inicio para la píldora de estado), pero esta hoja lo descartaba y
 * `HojaPagar` ofrecía "Ya transferí, avisar" aunque el pago ya estuviera
 * avisado o confirmado — al vecino que ya pagó se le seguía pidiendo que
 * avisara otra vez.
 */
export function HojaPagarConDatos({ mes, dpto }: { mes: MesId; dpto: DptoId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pagar', mes, dpto],
    queryFn: async (): Promise<{
      resultado: ResultadoMes
      pago: Pago | null
      cuenta: { banco: string; numero: string; cci: string; titular: string }
    }> => {
      const [mesR, cuentaR] = await Promise.all([fetch(`/api/meses/${mes}`), fetch('/api/cuenta')])
      if (!mesR.ok || !cuentaR.ok) throw new Error('No se pudo cargar')
      const [m, c] = await Promise.all([mesR.json(), cuentaR.json()])
      return { resultado: m.resultado, pago: m.pagos?.[dpto] ?? null, cuenta: c.cuenta }
    },
  })

  if (isLoading || isError || !data?.resultado.valido) {
    return (
      <Hoja titulo="Cómo pagar">
        <div className="hoja-cuerpo">
          <p className="tipo-cuerpo-menor text-gris">
            {isError ? 'No se pudo cargar. Revisa la conexión y vuelve a intentarlo.' : 'Cargando…'}
          </p>
        </div>
      </Hoja>
    )
  }

  return (
    <HojaPagar
      mes={mes}
      dpto={dpto}
      monto={data.resultado.cuotas[dpto].total}
      cuenta={data.cuenta}
      pago={data.pago}
    />
  )
}
