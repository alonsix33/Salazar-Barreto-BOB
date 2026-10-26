'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'
import { fmt, round2 } from '@/lib/calculo/redondeo'
import { useNumpad } from '@/components/Numpad'

/**
 * «+ Añadir un gasto fijo»: nombre, si es anual, y el monto o «por confirmar».
 *
 * Una sola pieza para el paso 4 del cierre y para la hoja de gastos fijos del
 * panel. Esa hoja solo sabía activar y desactivar, y el panel decía «se editan
 * desde el paso 4», o sea que **agregar** un gasto fijo solo se podía en mitad
 * de un cierre. La interfaz prometía una administración que no daba.
 *
 * `anual` pide el **total al año**, no el mensual: el motor guarda el mensual,
 * así que aquí se divide entre 12 antes de entregarlo.
 */
export function NuevoFijo({
  existentes,
  onGuardar,
}: {
  /** Los conceptos que ya hay, para no repetir el nombre. */
  existentes: readonly string[]
  onGuardar: (nuevo: { concepto: string; monto: number | null; anual: boolean }) => void
}) {
  const { abrir } = useNumpad()
  const [agregando, setAgregando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [anual, setAnual] = useState(false)
  const nombreLimpio = nombre.trim()
  const yaExiste = existentes.some((c) => c.toLowerCase() === nombreLimpio.toLowerCase())

  const guardar = (tecleado: number | null) => {
    if (!nombreLimpio || yaExiste) return
    const monto = tecleado === null ? null : anual ? round2(tecleado / 12) : tecleado
    onGuardar({ concepto: nombreLimpio, monto, anual })
    setNombre('')
    setAnual(false)
    setAgregando(false)
  }

  if (!agregando) {
    return (
      <button type="button" onClick={() => setAgregando(true)} className="puntual-boton fijo-anadir">
        <span className="tipo-cuerpo-lista block">+ {COPYS.cierre.anadirConcepto}</span>
        <span className="tipo-contexto-chico block text-gris puntual-boton-ejemplo">
          {COPYS.cierre.anadirConceptoEjemplo}
        </span>
      </button>
    )
  }

  return (
    <div className="fijo-nuevo">
      {/*
        El nombre de un concepto es texto —«Limpieza», «Pozo a tierra»—, así
        que teclado normal. El monto de al lado, en cambio, abre el numpad:
        son dos campos contiguos con dos teclados distintos, y esa es
        exactamente la diferencia que hay que respetar.
      */}
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={COPYS.cierre.nombreConcepto}
        aria-label={COPYS.cierre.nombreConcepto}
        maxLength={80}
        className="fijo-nuevo-nombre"
        autoCapitalize="sentences"
        autoComplete="off"
        enterKeyHint="done"
        autoFocus
      />
      <label className="fijo-nuevo-anual">
        <input type="checkbox" checked={anual} onChange={(e) => setAnual(e.target.checked)} className="casilla" />
        <span className="tipo-cuerpo-chico">{COPYS.cierre.conceptoAnual}</span>
      </label>
      {yaExiste && <p className="tipo-contexto-chico text-ambar">{COPYS.cierre.conceptoRepetido}</p>}
      <div className="fijo-nuevo-acciones">
        <button
          type="button"
          disabled={!nombreLimpio || yaExiste}
          onClick={() =>
            abrir({
              etiqueta: anual ? `${nombreLimpio} · ${COPYS.cierre.conceptoTotalAlAnio.toLowerCase()}` : nombreLimpio,
              decimales: true,
              maxDecimales: 2,
              sufijo: 'S/',
              ...(anual ? { ayuda: (v: number) => `Eso son S/ ${fmt(round2(v / 12))} al mes` } : {}),
              onOk: (v) => guardar(v),
            })
          }
          className="fijo-nuevo-boton"
        >
          {COPYS.cierre.conceptoConMonto}
        </button>
        <button
          type="button"
          disabled={!nombreLimpio || yaExiste}
          onClick={() => guardar(null)}
          className="fijo-nuevo-boton"
        >
          {COPYS.cierre.conceptoPorConfirmar}
        </button>
      </div>
      <button type="button" onClick={() => setAgregando(false)} className="fijo-nuevo-cancelar tipo-contexto-chico">
        {COPYS.cierre.conceptoCancelar}
      </button>
    </div>
  )
}
