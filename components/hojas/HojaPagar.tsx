'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/calculo/redondeo'
import { etiquetaMes } from '@/lib/calculo/mes'
import type { DptoId, MesId, Pago } from '@/lib/calculo/tipos'
import { COPYS } from '@/lib/copys'
import { estadoCuota } from '@/lib/estados'
import { useAnuncio } from '@/components/Anuncio'
import { Hoja } from './Hoja'
import { useHoja } from './Hojas'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * `pagar` · Cómo pagar. `03-pantallas.md`.
 *
 * Los datos de la cuenta, el monto exacto, y el botón que dispara el aviso.
 * El aviso **no confirma el pago**: lo verifica una persona contra el estado de
 * cuenta.
 *
 * `pago` decide qué va debajo de la cuenta: sin él, el botón de avisar de
 * siempre; avisado o confirmado, un mensaje en su lugar y **sin** botón de
 * avisar. Antes esta hoja no recibía `pago` y ofrecía "Ya transferí, avisar"
 * sin importar que el mes ya estuviera avisado o confirmado.
 */
export function HojaPagar({
  mes,
  dpto,
  monto,
  cuenta,
  pago,
}: {
  mes: MesId
  dpto: DptoId
  monto: number
  cuenta: { banco: string; numero: string; cci: string; titular: string }
  pago: Pago | null
}) {
  const { abrir, cerrar } = useHoja()
  const estado = estadoCuota(pago, monto)
  const anunciar = useAnuncio()
  const router = useRouter()
  const [copiado, setCopiado] = useState(false)

  const avisar = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/pagos/aviso', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mes, dpto }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo avisar')
      return cuerpo
    },
    onSuccess: () => {
      // El aviso a lector de pantalla va **antes** de abrir la hoja: la hoja
      // mueve el foco y anuncia su propio título, y si el estado se dijera
      // después, los dos anuncios se pisarían.
      anunciar(COPYS.anuncios.pagoAvisado(etiquetaMes(mes)))
      router.refresh()
      abrir('aviso-ok')
    },
  })

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cuenta.numero)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el número está a la vista igual.
      setCopiado(false)
    }
  }

  return (
    <Hoja titulo={`Cómo pagar ${etiquetaMes(mes)}`}>
      <div className="hoja-cuerpo">
        <h2 className="tipo-titulo-hoja pagar-titulo">Cómo pagar {etiquetaMes(mes)}</h2>
        <p className="tipo-cuerpo-chico text-gris pagar-intro">
          Transferencia a la cuenta conjunta del edificio.
        </p>

        <div className="pagar-tarjeta">
          <p className="tipo-etiqueta-pequena text-sobre-noche-etiqueta pagar-etiqueta">Monto exacto</p>
          <p className="pagar-monto">
            <span className="tipo-simbolo-chico text-sobre-noche-terciario">S/</span>
            <span className="pagar-monto-cifra">{fmt(monto)}</span>
          </p>
          <div className="pagar-cuenta">
            <p className="tipo-etiqueta-pequena text-sobre-noche-etiqueta pagar-etiqueta">
              Cuenta conjunta · {cuenta.banco}
            </p>
            <div className="flex items-center justify-between gap-fila-x">
              <span className="tipo-simbolo-chico">{cuenta.numero}</span>
              <button type="button" onClick={copiar} className="pagar-copiar">
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="tipo-contexto-mini text-sobre-noche-terciario pagar-cci">
              CCI {cuenta.cci} · {cuenta.titular}
            </p>
          </div>
        </div>

        <div className="pagar-nota">
          <p className="tipo-cuerpo-chico text-gris">
            {estado === 'al-dia' && COPYS.hojas.pagar.yaConfirmado.texto}
            {estado === 'en-verificacion' && COPYS.hojas.pagar.yaAvisado.texto}
            {estado === 'sin-cobro' && COPYS.inicio.detalleSinCobro}
            {estado === 'sin-registrar' &&
              'Cuando transfieras, avisa aquí con el número de operación. Quien administra lo confirma contra el estado de cuenta.'}
          </p>
        </div>

        {avisar.isError && <Fallo>{mensajeDeError(avisar.error)}</Fallo>}

        {estado === 'sin-registrar' ? (
          <>
            <button
              type="button"
              onClick={() => avisar.mutate()}
              aria-disabled={avisar.isPending}
              className="pagar-boton"
            >
              {avisar.isPending ? 'Avisando…' : 'Ya transferí, avisar'}
            </button>
            <button type="button" onClick={cerrar} className="pagar-cancelar tipo-cuerpo-enlace text-gris">
              Todavía no
            </button>
          </>
        ) : (
          // Ya avisado, ya confirmado, o sin cobro este mes: nada que disparar,
          // solo cerrar. Repetir el aviso aquí es lo que rechazaba el servidor
          // con un 409 — mostrarlo así evita que el vecino llegue a verlo.
          <button type="button" onClick={cerrar} className="pagar-boton">
            Entendido
          </button>
        )}
      </div>
    </Hoja>
  )
}
