'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'
import { fmt, round2 } from '@/lib/calculo/redondeo'
import { CONCEPTO_AGUA, CONCEPTO_LUZ } from '@/lib/calculo/constantes'
import { useNumpad } from '@/components/Numpad'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'
import { AvisoBob } from './AvisoBob'
import { BobDice } from '@/components/BobDice'
import { MOMENTOS } from '@/lib/bob/momentos'
import { Fallo } from '@/components/ui/Fallo'

/**
 * Paso 4 · Los gastos fijos. `04-cierre-del-mes.md`.
 *
 * Ya están puestos con su monto habitual. El **pozo a tierra** aparece sin cifra
 * y con fondo ámbar: es un gasto real cuya cifra nadie confirmó todavía. **No
 * bloquea el avance**, porque no tenerla no impide cerrar el mes.
 */
export function Paso4Fijos({ borrador, guardar, guardando, errorGuardar, avanzar }: PropsPaso) {
  const { abrir } = useNumpad()
  const fijos = borrador.resultado.gastos.filter(
    (g) => g.concepto !== CONCEPTO_AGUA && g.concepto !== CONCEPTO_LUZ && !g.extra,
  )
  const suman = fijos.reduce((s, g) => s + (g.monto ?? 0), 0)
  const sinCifra = fijos.filter((g) => g.porConfirmar)

  const [agregando, setAgregando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [anual, setAnual] = useState(false)
  const nombreLimpio = nombre.trim()
  const yaExiste = fijos.some((g) => g.concepto.toLowerCase() === nombreLimpio.toLowerCase())

  /**
   * `anual` pide el **total al año**, no el mensual: el motor guarda siempre
   * el monto mensual, así que aquí se divide entre 12 antes de mandarlo.
   * `ayuda` del numpad muestra el mensual en vivo mientras se teclea el total,
   * para que quien cierra el mes no tenga que sacar la cuenta en la cabeza.
   */
  const guardarNuevo = (montoTecleado: number | null) => {
    if (!nombreLimpio || yaExiste) return
    const monto = montoTecleado === null ? null : anual ? round2(montoTecleado / 12) : montoTecleado
    void guardar('gastos-fijos', { concepto: nombreLimpio, monto, anual })
    setNombre('')
    setAnual(false)
    setAgregando(false)
  }

  /** El concepto existente cuyo panel de anual/activo está abierto, si hay uno. */
  const [editando, setEditando] = useState<string | null>(null)
  const [anualEdit, setAnualEdit] = useState(false)

  const abrirEdicion = (g: (typeof fijos)[number]) => {
    setAnualEdit(!!g.anual)
    setEditando(g.concepto)
  }

  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.fijosTitulo}</h2>
      <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.cierre.fijosIntro}</p>

      {fijos.map((g) => (
        <div key={g.concepto} className={g.porConfirmar ? 'fijo-fila fijo-fila-pendiente' : 'fijo-fila'}>
          <button
            type="button"
            onClick={() =>
              abrir({
                etiqueta: g.anual ? `${g.concepto} · ${COPYS.cierre.conceptoTotalAlAnio.toLowerCase()}` : g.concepto,
                // El motor guarda el mensual; aquí se enseña y se pide el total.
                valorInicial: g.anual && g.monto != null ? round2(g.monto * 12) : g.monto,
                decimales: true,
                maxDecimales: 2,
                sufijo: 'S/',
                ...(g.anual
                  ? { ayuda: (v: number) => `Eso son S/ ${fmt(round2(v / 12))} al mes` }
                  : {}),
                onOk: (v) =>
                  void guardar('gastos-fijos', {
                    concepto: g.concepto,
                    monto: g.anual ? round2(v / 12) : v,
                  }),
              })
            }
            className="fijo-fila-monto"
          >
            <span className="tipo-cuerpo-medio flex min-w-0 flex-1 items-center gap-etiqueta">
              <span className="truncate">{g.concepto}</span>
              {g.anual && <span className="tipo-etiqueta-anual etiqueta-anual">{COPYS.mes.anual}</span>}
            </span>
            <span className={g.porConfirmar ? 'tipo-etiqueta-pequena text-ambar' : 'tipo-monto-lista'}>
              {g.porConfirmar ? COPYS.cierre.escribirMonto : fmt(g.monto)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => (editando === g.concepto ? setEditando(null) : abrirEdicion(g))}
            className="fijo-fila-editar"
            aria-label={`${COPYS.cierre.conceptoEditar} ${g.concepto}`}
            aria-expanded={editando === g.concepto}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="5" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="12" cy="19" r="1.4" />
            </svg>
          </button>
          {editando === g.concepto && (
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
                    void guardar('gastos-fijos', { concepto: g.concepto, monto: g.monto, anual: anualEdit })
                    setEditando(null)
                  }}
                  className="fijo-nuevo-boton"
                >
                  {COPYS.cierre.conceptoGuardar}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void guardar('gastos-fijos', { concepto: g.concepto, monto: g.monto, activo: false })
                    setEditando(null)
                  }}
                  className="fijo-nuevo-boton fijo-nuevo-boton-ambar"
                >
                  {COPYS.cierre.conceptoDesactivar}
                </button>
              </div>
              <button type="button" onClick={() => setEditando(null)} className="fijo-nuevo-cancelar tipo-contexto-chico">
                {COPYS.cierre.conceptoCancelar}
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="fijos-suman">
        <span className="tipo-etiqueta-seccion text-sobre-noche-etiqueta">{COPYS.cierre.suman}</span>
        <span className="tipo-cifra-bloque">{fmt(suman)}</span>
      </div>

      {!agregando ? (
        <button type="button" onClick={() => setAgregando(true)} className="puntual-boton fijo-anadir">
          <span className="tipo-cuerpo-lista block">+ {COPYS.cierre.anadirConcepto}</span>
          <span className="tipo-contexto-chico block text-gris puntual-boton-ejemplo">
            {COPYS.cierre.anadirConceptoEjemplo}
          </span>
        </button>
      ) : (
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
                  ...(anual
                    ? { ayuda: (v: number) => `Eso son S/ ${fmt(round2(v / 12))} al mes` }
                    : {}),
                  onOk: (v) => guardarNuevo(v),
                })
              }
              className="fijo-nuevo-boton"
            >
              {COPYS.cierre.conceptoConMonto}
            </button>
            <button
              type="button"
              disabled={!nombreLimpio || yaExiste}
              onClick={() => guardarNuevo(null)}
              className="fijo-nuevo-boton"
            >
              {COPYS.cierre.conceptoPorConfirmar}
            </button>
          </div>
          <button type="button" onClick={() => setAgregando(false)} className="fijo-nuevo-cancelar tipo-contexto-chico">
            {COPYS.cierre.conceptoCancelar}
          </button>
        </div>
      )}

      {sinCifra.length > 0 && (
        <AvisoBob>
          <BobDice
            momento="cierre-sin-cifra"
            datos={{ concepto: sinCifra[0]!.concepto }}
            mes={borrador.mes}
            dpto={null}
          >
            {MOMENTOS['cierre-sin-cifra'].determinista({ concepto: sinCifra[0]!.concepto })}
          </BobDice>
        </AvisoBob>
      )}
      {errorGuardar && <Fallo>{errorGuardar}</Fallo>}

      <BotonAvanzar onClick={avanzar} cargando={guardando}>
        {COPYS.cierre.confirmarSeguir}
      </BotonAvanzar>
    </div>
  )
}
