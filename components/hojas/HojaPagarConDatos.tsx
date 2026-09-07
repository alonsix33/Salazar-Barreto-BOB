'use client'

import { useQuery } from '@tanstack/react-query'
import type { DptoId, MesId, ResultadoMes } from '@/lib/calculo/tipos'
import { HojaPagar } from './HojaPagar'
import { Hoja } from './Hoja'

/**
 * Carga lo que la hoja de pago necesita: el monto exacto de este mes y los
 * datos de la cuenta. Se pide al abrir, no en cada carga de pantalla.
 */
export function HojaPagarConDatos({ mes, dpto }: { mes: MesId; dpto: DptoId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pagar', mes, dpto],
    queryFn: async (): Promise<{
      resultado: ResultadoMes
      cuenta: { banco: string; numero: string; cci: string; titular: string }
    }> => {
      const [mesR, cuentaR] = await Promise.all([fetch(`/api/meses/${mes}`), fetch('/api/cuenta')])
      if (!mesR.ok || !cuentaR.ok) throw new Error('No se pudo cargar')
      const [m, c] = await Promise.all([mesR.json(), cuentaR.json()])
      return { resultado: m.resultado, cuenta: c.cuenta }
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
    <HojaPagar mes={mes} dpto={dpto} monto={data.resultado.cuotas[dpto].total} cuenta={data.cuenta} />
  )
}
