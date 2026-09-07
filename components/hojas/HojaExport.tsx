'use client'

import { useState } from 'react'
import { Hoja } from './Hoja'
import { Fallo } from '@/components/ui/Fallo'

/**
 * `export` · Exportar el año. **Con la descarga de verdad.**
 *
 * El prototipo tenía la pantalla y no el archivo. Aquí el botón pide
 * `/api/export/[anio]`, que genera un `.xlsx` con el mismo motor que la app: si
 * el Excel y la pantalla no coincidieran, uno de los dos mentiría.
 */
export function HojaExport({
  anios,
}: {
  anios: readonly { anio: number; mesesPublicados: number; desde: string; hasta: string }[]
}) {
  const [bajando, setBajando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const descargar = async (anio: number) => {
    setBajando(anio)
    setError(null)
    try {
      const r = await fetch(`/api/export/${anio}`)
      if (!r.ok) throw new Error('No se pudo generar el archivo')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edificio-salazar-barreto-${anio}.xlsx`
      document.body.append(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el archivo')
    } finally {
      setBajando(null)
    }
  }

  const incluye = [
    'Las 7 cuotas de cada mes con su desglose',
    'Las lecturas de medidor y los consumos',
    'Los recibos de agua y de luz común',
    'Todos los gastos, mes por mes',
    'Los pagos con fecha y número de operación',
    'La cuenta: recibido, gastado y saldo',
  ]

  /**
   * Qué va dentro de verdad, en una línea.
   *
   * El prototipo la tenía —«6 meses de 2026, desde enero»— y se cayó al portar.
   * Sin ella, el botón «Descargar 2026 en Excel» se lee como el año entero, y lo
   * que baja son los meses **publicados**: el que se está cerrando no entra,
   * porque todavía no existe para los vecinos.
   */
  const alcance = (a: { mesesPublicados: number; anio: number; desde: string; hasta: string }) =>
    a.mesesPublicados === 1
      ? `1 mes de ${a.anio}: ${a.desde}.`
      : `${a.mesesPublicados} meses de ${a.anio}, de ${a.desde} a ${a.hasta}.`

  return (
    <Hoja titulo="Exportar el año">
      <div className="hoja-cuerpo">
        <h2 className="tipo-titulo-hoja pagar-titulo">Exportar el año</h2>
        <p className="tipo-cuerpo-chico text-gris pagar-intro">
          Un archivo con todo lo que hay en la app, mes por mes.
        </p>

        <div className="pagar-nota">
          <p className="tipo-etiqueta-pequena text-gris publicar-etiqueta">Va a incluir</p>
          <ul className="publicar-lista">
            {incluye.map((x) => (
              <li key={x} className="publicar-punto">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-verde publicar-check" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span className="tipo-cuerpo-menor">{x}</span>
              </li>
            ))}
          </ul>
        </div>

        {error && <Fallo>{error}</Fallo>}

        {anios.length === 0 && (
          <p className="tipo-cuerpo-menor text-gris pagar-error">
            Todavía no hay ningún mes publicado que exportar.
          </p>
        )}
        {anios.map((a) => (
          <div key={a.anio}>
            <button
              type="button"
              onClick={() => void descargar(a.anio)}
              aria-disabled={bajando === a.anio}
              className="cierre-boton"
            >
              {bajando === a.anio ? 'Generando…' : `Descargar ${a.anio} en Excel`}
            </button>
            <p className="tipo-contexto text-gris export-alcance">{alcance(a)}</p>
          </div>
        ))}
      </div>
    </Hoja>
  )
}
