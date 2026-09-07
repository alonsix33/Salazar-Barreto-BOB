'use client'

import { useQuery } from '@tanstack/react-query'
import { fmt } from '@/lib/calculo/redondeo'
import { fechaCorta } from '@/lib/formato'
import type { DptoId } from '@/lib/calculo/tipos'
import type { HistorialDpto } from '@/lib/datos/historial'
import { Hoja } from './Hoja'

/**
 * `pagos` y `agua` · la historia del departamento. `03-pantallas.md`.
 *
 * Son la misma hoja con dos columnas distintas, porque son la misma lista de
 * meses vista desde dos lados. Separarlas en dos componentes duplicaría el
 * mismo scroll y la misma carga.
 */
export function HojaHistorial({ dpto, modo }: { dpto: DptoId; modo: 'pagos' | 'agua' }) {
  const esAgua = modo === 'agua'
  const { data, isLoading, isError } = useQuery({
    queryKey: ['historial', dpto],
    queryFn: async (): Promise<HistorialDpto> => {
      const r = await fetch(`/api/dptos/${dpto}/historial`)
      if (!r.ok) throw new Error('No se pudo cargar el historial')
      return r.json()
    },
  })

  const filas = [...(data?.filas ?? [])].reverse()

  return (
    <Hoja titulo={esAgua ? `Tu consumo de agua · ${dpto}` : `Historial de pagos · ${dpto}`} altura="alta">
      <div className="hoja-cuerpo">
        <p className={`tipo-etiqueta-pequena ${esAgua ? 'text-agua' : 'text-gris'} historial-hoja-etiqueta`}>
          {esAgua ? `Tu consumo de agua · ${dpto}` : `Historial de pagos · ${dpto}`}
        </p>
        <h2 className="tipo-titulo-hoja historial-hoja-titulo">
          {filas.length} {esAgua ? 'meses de lecturas' : 'meses registrados'}
        </h2>

        {isLoading && <p className="tipo-cuerpo-menor text-gris">Cargando…</p>}
        {isError && (
          <p className="tipo-cuerpo-menor text-gris">
            No se pudo cargar. Revisa la conexión y vuelve a intentarlo.
          </p>
        )}
        {!isLoading && !isError && filas.length === 0 && (
          <p className="tipo-cuerpo-menor text-gris">
            Todavía no hay meses publicados. Aquí van a aparecer en cuanto se cierre el primero.
          </p>
        )}

        {filas.map((f) =>
          esAgua ? (
            <div key={f.mes} className="historial-hoja-fila">
              <span className="tipo-cuerpo-chico min-w-0 flex-1 truncate">{f.etiqueta}</span>
              <span className="tipo-mono-etiqueta historial-hoja-m3 text-gris">{fmt(f.m3)} m³</span>
              <span className="tipo-monto-lista-chico historial-hoja-monto">
                {f.cuota === null ? '—' : fmt(f.cuota)}
              </span>
            </div>
          ) : (
            <div key={f.mes} className="historial-hoja-fila">
              <span className="min-w-0 flex-1">
                <span className="tipo-cuerpo-chico block">{f.etiqueta}</span>
                <span className="tipo-contexto-mini block text-gris historial-hoja-detalle">
                  {f.estado === 'aviso'
                    ? `avisó el ${fechaCorta(f.fecha)}`
                    : f.estado === 'confirmado'
                      ? `${fechaCorta(f.fecha)} · op. ${f.operacion ?? '—'}`
                      : 'sin registrar'}
                </span>
              </span>
              <span className="tipo-monto-lista-chico historial-hoja-cuota">
                {f.cuota === null ? '—' : fmt(f.cuota)}
              </span>
              {/* El punto es color, y el color nunca es el único portador de
                  información (`02` §8). Un `aria-label` sobre un `<span>` sin rol
                  **no lo lee ningún lector de pantalla**: quien abría este
                  historial oía seis meses, seis fechas y seis montos, y ni una
                  sola vez «al día» o «sin registrar». */}
              <span
                aria-hidden="true"
                className={`punto ${
                  f.estado === 'confirmado' ? 'bg-verde' : f.estado === 'aviso' ? 'bg-agua' : 'bg-ambar'
                }`}
              />
              <span className="sr-only">
                {f.estado === 'confirmado'
                  ? 'Al día.'
                  : f.estado === 'aviso'
                    ? 'En verificación.'
                    : 'Sin registrar.'}
              </span>
            </div>
          ),
        )}
      </div>
    </Hoja>
  )
}
