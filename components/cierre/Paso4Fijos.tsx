'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { CONCEPTO_AGUA, CONCEPTO_LUZ } from '@/lib/calculo/constantes'
import { useNumpad } from '@/components/Numpad'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'
import { AvisoBob } from './AvisoBob'
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

  const guardarNuevo = (monto: number | null) => {
    if (!nombreLimpio || yaExiste) return
    void guardar('gastos-fijos', { concepto: nombreLimpio, monto, anual })
    setNombre('')
    setAnual(false)
    setAgregando(false)
  }

  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.fijosTitulo}</h2>
      <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.cierre.fijosIntro}</p>

      {fijos.map((g) => (
        <button
          key={g.concepto}
          type="button"
          onClick={() =>
            abrir({
              etiqueta: g.concepto,
              valorInicial: g.monto,
              decimales: true,
              maxDecimales: 2,
              sufijo: 'S/',
              onOk: (v) => void guardar('gastos-fijos', { concepto: g.concepto, monto: v }),
            })
          }
          className={g.porConfirmar ? 'fijo-fila fijo-fila-pendiente' : 'fijo-fila'}
        >
          <span className="tipo-cuerpo-medio flex min-w-0 flex-1 items-center gap-etiqueta">
            <span className="truncate">{g.concepto}</span>
            {g.anual && <span className="tipo-etiqueta-anual etiqueta-anual">{COPYS.mes.anual}</span>}
          </span>
          <span className={g.porConfirmar ? 'tipo-etiqueta-pequena text-ambar' : 'tipo-monto-lista'}>
            {g.porConfirmar ? COPYS.cierre.escribirMonto : fmt(g.monto)}
          </span>
        </button>
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
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={COPYS.cierre.nombreConcepto}
            aria-label={COPYS.cierre.nombreConcepto}
            maxLength={80}
            className="fijo-nuevo-nombre"
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
                  etiqueta: nombreLimpio,
                  decimales: true,
                  maxDecimales: 2,
                  sufijo: 'S/',
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
          {`${sinCifra[0]!.concepto} sigue sin cifra. Puedes dejarlo así y ponerlo cuando lo tengas.`}
        </AvisoBob>
      )}
      {errorGuardar && <Fallo>{errorGuardar}</Fallo>}

      <BotonAvanzar onClick={avanzar} cargando={guardando}>
        {COPYS.cierre.confirmarSeguir}
      </BotonAvanzar>
    </div>
  )
}
