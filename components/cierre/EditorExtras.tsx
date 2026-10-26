'use client'

import { useEffect, useRef, useState } from 'react'
import { COPYS } from '@/lib/copys'
import { DPTOS } from '@/lib/calculo/constantes'
import { fmt } from '@/lib/calculo/redondeo'
import type { DptoId, Extra } from '@/lib/calculo/tipos'
import { useNumpad } from '@/components/Numpad'

/**
 * La lista de gastos puntuales y créditos de un mes: añadir, nombrar, decir
 * quiénes lo pagan y quitar.
 *
 * Es **una sola pieza** para el paso 5 del cierre y para corregir un mes ya
 * publicado: dos copias de «qué es un gasto válido y cómo se reparte» es justo
 * lo que acaba separándose. Es controlada: no guarda nada, avisa con
 * `onCambiar` de cómo debe quedar la lista y quien la monta decide qué hacer
 * (el cierre la manda al servidor en cada cambio; la corrección la guarda en un
 * borrador hasta la revisión).
 *
 * Dos cosas que no se pueden confundir:
 *
 *  - un **gasto extraordinario** se suma al total y lo pagan los siete por flat;
 *  - un **crédito** se resta de la cuota de un departamento y **sale del saldo
 *    de la cuenta**, no del bolsillo de los demás.
 *
 * Un crédito sin departamento se evapora —no se le resta a nadie y el mes
 * cuadra igual—, así que no entra a la lista hasta que se elige a favor de quién.
 */
export function EditorExtras({
  extras,
  onCambiar,
}: {
  extras: readonly Extra[]
  onCambiar: (lista: Extra[]) => void
}) {
  const { abrir } = useNumpad()
  /** Índice del gasto al que se le está eligiendo quiénes lo pagan. */
  const [eligiendoQuienes, setEligiendoQuienes] = useState<number | null>(null)
  /** El crédito ya tiene monto y falta decir a favor de quién. */
  const [creditoPendiente, setCreditoPendiente] = useState<number | null>(null)
  /** Índice del gasto cuyo nombre se está cambiando, y lo que lleva escrito. */
  const [renombrando, setRenombrando] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const campoNombre = useRef<HTMLInputElement>(null)
  /** Se escribió algo en el campo: solo entonces perder el foco lo guarda. */
  const escribio = useRef(false)

  /**
   * El foco al campo del nombre, un momento después de abrirlo. Al cerrarse, el
   * teclado numérico le devuelve el foco al botón desde el que se abrió, y eso
   * dejaba el campo recién abierto sin foco y —con el guardado al perder el
   * foco— cerrado antes de que nadie pudiera escribir en él.
   */
  useEffect(() => {
    if (renombrando === null) return
    escribio.current = false
    const t = setTimeout(() => campoNombre.current?.focus(), 250)
    return () => clearTimeout(t)
  }, [renombrando])

  const anadirGasto = () =>
    abrir({
      etiqueta: COPYS.cierre.montoGasto,
      decimales: true,
      maxDecimales: 2,
      sufijo: 'S/',
      onOk: (monto) => {
        onCambiar([...extras, { tipo: 'gasto', concepto: COPYS.cierre.gastoSinNombre, monto }])
        // Recién añadido, se pide el nombre: «Gasto extraordinario» no le dice
        // nada a los siete que reciben el aviso.
        setNombre('')
        setRenombrando(extras.length)
      },
    })

  const anadirCredito = () =>
    abrir({
      etiqueta: COPYS.cierre.montoCredito,
      decimales: true,
      maxDecimales: 2,
      sufijo: 'S/',
      onOk: (monto) => setCreditoPendiente(monto),
    })

  const asignarDpto = (dpto: DptoId) => {
    if (creditoPendiente === null) return
    onCambiar([...extras, { tipo: 'credito', concepto: 'Crédito', monto: creditoPendiente, dpto }])
    setCreditoPendiente(null)
  }

  const guardarNombre = (indice: number) => {
    const limpio = nombre.trim()
    if (limpio) {
      onCambiar(extras.map((e, i) => (i === indice && e.tipo === 'gasto' ? { ...e, concepto: limpio } : e)))
    }
    setRenombrando(null)
  }

  /**
   * Alterna si un departamento paga este gasto.
   *
   * Se guarda la lista de los que SÍ pagan, y vacía significa "los siete": así
   * un gasto normal no arrastra una lista de siete ids que hay que mantener en
   * sincronía con los departamentos reales.
   */
  const alternarQuien = (indice: number, dpto: DptoId) => {
    onCambiar(
      extras.map((e, i) => {
        if (i !== indice || e.tipo !== 'gasto') return e
        const actuales: DptoId[] =
          e.participantes && e.participantes.length > 0 ? [...e.participantes] : DPTOS.map((d) => d.id)
        const sigue = actuales.includes(dpto) ? actuales.filter((x) => x !== dpto) : [...actuales, dpto]
        // Quitarlos a todos no tiene sentido: el gasto lo paga alguien.
        if (sigue.length === 0) return e
        const todos = sigue.length === DPTOS.length
        return { ...e, participantes: todos ? [] : DPTOS.filter((d) => sigue.includes(d.id)).map((d) => d.id) }
      }),
    )
  }

  /** Los que NO pagan un gasto. Vacío = lo pagan los siete. */
  const fueraDe = (e: Extra): DptoId[] =>
    e.tipo === 'gasto' && e.participantes && e.participantes.length > 0
      ? DPTOS.filter((d) => !e.participantes!.includes(d.id)).map((d) => d.id)
      : []

  const quitar = (indice: number) => {
    setEligiendoQuienes(null)
    setRenombrando(null)
    onCambiar(extras.filter((_, i) => i !== indice))
  }

  return (
    <>
      <button type="button" onClick={anadirGasto} className="puntual-boton">
        <span className="tipo-cuerpo-lista block">+ {COPYS.cierre.anadirGasto}</span>
        <span className="tipo-contexto-chico block text-gris puntual-boton-ejemplo">
          {COPYS.cierre.anadirGastoEjemplo}
        </span>
      </button>
      <button type="button" onClick={anadirCredito} className="puntual-boton">
        <span className="tipo-cuerpo-lista block">+ {COPYS.cierre.anadirCredito}</span>
        <span className="tipo-contexto-chico block text-gris puntual-boton-ejemplo">
          {COPYS.cierre.anadirCreditoEjemplo}
        </span>
      </button>

      {extras.length > 0 && (
        <>
          <p className="tipo-etiqueta-seccion text-gris puntual-etiqueta">
            {COPYS.cierre.anadidos(extras.length)}
          </p>
          {extras.map((e, i) => (
            <div key={i} className="puntual-anadido">
              <span className="min-w-0 flex-1">
                {renombrando === i ? (
                  <input
                    type="text"
                    value={nombre}
                    ref={campoNombre}
                    onChange={(ev) => {
                      escribio.current = true
                      setNombre(ev.target.value)
                    }}
                    onBlur={() => {
                      if (escribio.current) guardarNombre(i)
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') guardarNombre(i)
                    }}
                    placeholder={COPYS.cierre.nombreDelGasto}
                    aria-label={COPYS.cierre.nombreDelGasto}
                    maxLength={80}
                    className="fijo-nuevo-nombre"
                    autoCapitalize="sentences"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                ) : e.tipo === 'gasto' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNombre(e.concepto)
                      setRenombrando(i)
                    }}
                    className="tipo-cuerpo-lista block truncate puntual-nombre"
                    aria-label={`${COPYS.cierre.cambiarNombre}: ${e.concepto}`}
                  >
                    {e.concepto}
                  </button>
                ) : (
                  <span className="tipo-cuerpo-lista block truncate">{e.concepto}</span>
                )}
                {e.tipo === 'gasto' ? (
                  <button
                    type="button"
                    onClick={() => setEligiendoQuienes(eligiendoQuienes === i ? null : i)}
                    className="tipo-contexto-chico block text-gris puntual-quien puntual-quien-boton"
                  >
                    {fueraDe(e).length > 0
                      ? COPYS.cierre.loPaganAlgunos(fueraDe(e))
                      : COPYS.cierre.seRepartte}
                    {e.reparto === 'iguales' ? ` · ${COPYS.cierre.enPartesIguales}` : ''}
                  </button>
                ) : (
                  <span className="tipo-contexto-chico block text-gris puntual-quien">
                    {COPYS.cierre.aFavorDe(e.dpto)}
                  </span>
                )}
              </span>
              <span className="tipo-monto-lista">{fmt(e.monto)}</span>
              <button type="button" onClick={() => quitar(i)} className="puntual-quitar" aria-label="Quitar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 5l14 14M19 5 5 19" />
                </svg>
              </button>
            </div>
          ))}
        </>
      )}

      {eligiendoQuienes !== null && extras[eligiendoQuienes]?.tipo === 'gasto' && (
        <div className="puntual-elegir">
          <p className="tipo-cuerpo-destacado-medio puntual-elegir-titulo">
            {COPYS.cierre.quienesPagan}
          </p>
          <div className="puntual-dptos">
            {DPTOS.map((d) => {
              const fuera = fueraDe(extras[eligiendoQuienes]!).includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={!fuera}
                  onClick={() => alternarQuien(eligiendoQuienes, d.id)}
                  className="puntual-dpto"
                  data-fuera={fuera ? '' : undefined}
                >
                  {d.id}
                </button>
              )
            })}
          </div>
          <p className="tipo-contexto-chico text-gris puntual-elegir-nota">
            {COPYS.cierre.comoSeReparte}
          </p>
          <button
            type="button"
            onClick={() => setEligiendoQuienes(null)}
            className="boton-secundario puntual-elegir-listo"
          >
            {COPYS.cierre.listoQuienes}
          </button>
        </div>
      )}

      {creditoPendiente !== null && (
        <div className="puntual-elegir">
          <p className="tipo-cuerpo-destacado-medio puntual-elegir-titulo">¿A favor de quién?</p>
          <div className="puntual-dptos">
            {DPTOS.map((d) => (
              <button key={d.id} type="button" onClick={() => asignarDpto(d.id)} className="puntual-dpto">
                {d.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
