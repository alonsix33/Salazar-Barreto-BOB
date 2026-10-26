'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'
import { fmt, round2 } from '@/lib/calculo/redondeo'
import { useNumpad } from '@/components/Numpad'

/**
 * Una fila de gasto fijo: toca el monto para cambiarlo, y el ⋯ abre «es anual»
 * y «desactivar».
 *
 * Es la misma fila en el paso 4 del cierre y en corregir un mes publicado —una
 * sola copia de cómo se escribe un monto anual—, y no guarda nada: avisa de lo
 * que cambió y quien la monta decide si va al servidor o a un borrador.
 *
 * `anual` pide el **total al año**, no el mensual: el motor guarda siempre el
 * monto mensual, así que aquí se divide entre 12 al entregarlo. La `ayuda` del
 * numpad enseña el mensual en vivo mientras se teclea el total.
 */
export function FilaFijo({
  concepto,
  monto,
  anual,
  porConfirmar,
  onMonto,
  onAnual,
  onDesactivar,
}: {
  concepto: string
  /** Mensual, como lo guarda el motor. `null` = por confirmar. */
  monto: number | null
  anual: boolean
  porConfirmar: boolean
  onMonto: (mensual: number) => void
  onAnual: (anual: boolean) => void
  onDesactivar: () => void
}) {
  const { abrir } = useNumpad()
  const [editando, setEditando] = useState(false)
  const [anualEdit, setAnualEdit] = useState(anual)

  return (
    <div className={porConfirmar ? 'fijo-fila fijo-fila-pendiente' : 'fijo-fila'}>
      <button
        type="button"
        onClick={() =>
          abrir({
            etiqueta: anual ? `${concepto} · ${COPYS.cierre.conceptoTotalAlAnio.toLowerCase()}` : concepto,
            // El motor guarda el mensual; aquí se enseña y se pide el total.
            valorInicial: anual && monto != null ? round2(monto * 12) : monto,
            decimales: true,
            maxDecimales: 2,
            sufijo: 'S/',
            ...(anual ? { ayuda: (v: number) => `Eso son S/ ${fmt(round2(v / 12))} al mes` } : {}),
            onOk: (v) => onMonto(anual ? round2(v / 12) : v),
          })
        }
        className="fijo-fila-monto"
      >
        <span className="tipo-cuerpo-medio flex min-w-0 flex-1 items-center gap-etiqueta">
          <span className="truncate">{concepto}</span>
          {anual && <span className="tipo-etiqueta-anual etiqueta-anual">{COPYS.mes.anual}</span>}
        </span>
        <span className={porConfirmar ? 'tipo-etiqueta-pequena text-ambar' : 'tipo-monto-lista'}>
          {porConfirmar ? COPYS.cierre.escribirMonto : fmt(monto)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          setAnualEdit(anual)
          setEditando((e) => !e)
        }}
        className="fijo-fila-editar"
        aria-label={`${COPYS.cierre.conceptoEditar} ${concepto}`}
        aria-expanded={editando}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="5" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="12" cy="19" r="1.4" />
        </svg>
      </button>
      {editando && (
        <div className="fijo-editar">
          <label className="fijo-nuevo-anual">
            <input
              type="checkbox"
              checked={anualEdit}
              onChange={(e) => setAnualEdit(e.target.checked)}
              className="casilla"
            />
            <span className="tipo-cuerpo-chico">{COPYS.cierre.conceptoAnual}</span>
          </label>
          <div className="fijo-nuevo-acciones">
            <button
              type="button"
              onClick={() => {
                onAnual(anualEdit)
                setEditando(false)
              }}
              className="fijo-nuevo-boton"
            >
              {COPYS.cierre.conceptoGuardar}
            </button>
            <button
              type="button"
              onClick={() => {
                onDesactivar()
                setEditando(false)
              }}
              className="fijo-nuevo-boton fijo-nuevo-boton-ambar"
            >
              {COPYS.cierre.conceptoDesactivar}
            </button>
          </div>
          <button type="button" onClick={() => setEditando(false)} className="fijo-nuevo-cancelar tipo-contexto-chico">
            {COPYS.cierre.conceptoCancelar}
          </button>
        </div>
      )}
    </div>
  )
}
