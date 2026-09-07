'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import type { PropsPaso } from './Wizard'
import { useAnuncio } from '@/components/Anuncio'
import { BotonAvanzar } from './BotonAvanzar'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * Paso 7 · Publicar. `04-cierre-del-mes.md`.
 *
 * Antes de publicar, tres notas con estructura fija. **Vienen redactadas** con lo
 * que se ingresó, y el administrador corrige lo que quiera: escribir tres
 * párrafos desde cero, una vez al mes, es lo que hace que nadie los escriba.
 *
 * Al confirmar: el mes pasa a publicado, los siete lo ven, y **se genera un
 * aviso para todos**. Es la primera y única escritura del cierre que notifica.
 */
export function Paso7Publicar({
  borrador,
  nombreMes,
  onPublicado,
}: PropsPaso & { onPublicado: (total: number) => void }) {
  const anunciar = useAnuncio()
  const c = borrador.resultado
  const [notas, setNotas] = useState({
    quePaso: borrador.notaQuePaso ?? redactarQuePaso(borrador, nombreMes),
    queCambio: borrador.notaQueCambio ?? redactarQueCambio(borrador),
    quePendiente: borrador.notaQuePendiente ?? redactarQuePendiente(borrador),
  })
  // Si los tres salieron vacíos —un mes sin cerrar—, la intro no puede decir «ya
  // te la redacté»: no hay nada redactado. `01`/`04`: un rótulo tiene que ser
  // verdad en todos los estados, y el mes vacío es justo el estado en que se
  // entra al paso 7 por primera vez.
  const hayBorrador = !!(notas.quePaso || notas.queCambio || notas.quePendiente)

  const publicar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/meses/${borrador.mes}/publicar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notaQuePaso: notas.quePaso,
          notaQueCambio: notas.queCambio,
          notaQuePendiente: notas.quePendiente,
          version: borrador.version,
        }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo publicar')
      return cuerpo as { totalMes: number }
    },
    onSuccess: (d) => {
      anunciar(COPYS.anuncios.mesPublicado(nombreMes))
      onPublicado(d.totalMes)
    },
  })

  const campos = [
    { clave: 'quePaso' as const, etiqueta: COPYS.cierre.quePaso },
    { clave: 'queCambio' as const, etiqueta: COPYS.cierre.queCambio },
    { clave: 'quePendiente' as const, etiqueta: COPYS.cierre.quePendiente },
  ]

  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.notaTitulo}</h2>
      <p className="tipo-cuerpo-chico text-gris cierre-intro">{hayBorrador ? COPYS.cierre.notaIntro : COPYS.cierre.notaIntroVacia}</p>

      {campos.map((campo) => (
        <div key={campo.clave} className="nota-campo">
          <label htmlFor={`nota-${campo.clave}`} className="tipo-etiqueta-pequena text-gris nota-etiqueta">
            {campo.etiqueta}
          </label>
          <textarea
            id={`nota-${campo.clave}`}
            value={notas[campo.clave]}
            onChange={(e) => setNotas({ ...notas, [campo.clave]: e.target.value })}
            rows={3}
            maxLength={1000}
            className="nota-texto tipo-cuerpo-chico"
          />
        </div>
      ))}

      <div className="publicar-que-pasa">
        <p className="tipo-etiqueta-seccion text-gris publicar-etiqueta">{COPYS.cierre.alPublicar}</p>
        <ul className="publicar-lista">
          {COPYS.cierre.alPublicarPuntos.map((p) => (
            <li key={p} className="publicar-punto">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-verde publicar-check" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span className="tipo-cuerpo-menor">{p}</span>
            </li>
          ))}
        </ul>
      </div>

      {publicar.isError && (
        <Fallo>{mensajeDeError(publicar.error)}</Fallo>
      )}

      <BotonAvanzar
        onClick={() => publicar.mutate()}
        bloqueadoPor={c.cuadra ? null : COPYS.cierre.revisaFactura}
        cargando={publicar.isPending}
      >
        {COPYS.cierre.publicar(nombreMes)}
      </BotonAvanzar>
    </div>
  )
}

/**
 * Las tres notas, redactadas con lo que el administrador ingresó.
 *
 * Nada inventado: cada frase sale de una cifra del mes. Si no hay nada que
 * decir, lo dice.
 */
function redactarQuePaso(b: PropsPaso['borrador'], nombreMes: string): string {
  const c = b.resultado
  if (!c.valido) return ''
  return `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} cerró en S/ ${fmt(c.totalMes)}. El edificio consumió ${c.rec.aguaM3} m³ de agua y la factura de SEDAPAL fue de S/ ${fmt(c.facturaAgua)}.`
}

function redactarQueCambio(b: PropsPaso['borrador']): string {
  const c = b.resultado
  if (!c.valido) return ''
  const partes: string[] = []
  if (c.ajustado) {
    partes.push(
      `Los medidores sumaron ${fmt(c.sumaMedida)} m³ y SEDAPAL facturó ${c.rec.aguaM3}, así que a cada uno se le descontó la misma proporción`,
    )
  } else if (c.lavado > 0) {
    partes.push(
      `De la diferencia con los medidores, ${fmt(c.lavado)} m³ son el lavado del 401 y ${fmt(c.comunReal)} m³ quedan como área común`,
    )
  }
  for (const g of c.gastos.filter((x) => x.extra)) {
    partes.push(`se añadió un gasto extraordinario de S/ ${fmt(g.monto)} (${g.concepto})`)
  }
  if (c.totalCreditos > 0) partes.push(`se aplicaron créditos por S/ ${fmt(c.totalCreditos)}`)
  return partes.length > 0
    ? `${partes.join('; ')}.`
    : 'Este mes no hubo ajuste de agua, ni gasto extraordinario, ni créditos: el reparto fue el de siempre.'
}

function redactarQuePendiente(b: PropsPaso['borrador']): string {
  const c = b.resultado
  if (!c.valido) return ''
  const sinCifra = c.gastos.filter((g) => g.porConfirmar)
  if (sinCifra.length === 0) return 'Nada pendiente para el mes que viene.'
  return `${sinCifra.map((g) => g.concepto.toLowerCase()).join(' y ')} sigue${sinCifra.length > 1 ? 'n' : ''} sin cifra confirmada.`
}
