'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/calculo/redondeo'
import { fechaCorta } from '@/lib/formato'
import { nombreMes } from '@/lib/calculo/mes'
import { COPYS } from '@/lib/copys'
import { useAnuncio } from '@/components/Anuncio'
import { useNumpad } from '@/components/Numpad'
import type { FilaPago } from '@/lib/datos/admin'
import type { MesId } from '@/lib/calculo/tipos'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * Una fila de pago por verificar, con su botón de confirmar.
 *
 * Confirmar es lo único que mueve un pago a `confirmado` y por tanto lo único
 * que lo hace sumar al saldo. Lo hace una persona, contrastando contra el
 * estado de cuenta del banco.
 */
export function RegistrarPago({ pago, mes }: { pago: FilaPago; mes: MesId }) {
  const router = useRouter()
  const anunciar = useAnuncio()
  const { abrir } = useNumpad()
  const confirmar = useMutation({
    /** `monto` solo va cuando entró algo distinto de la cuota. */
    mutationFn: async (monto?: number) => {
      const r = await fetch('/api/pagos/confirmar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mes, dpto: pago.dpto, ...(monto === undefined ? {} : { monto }) }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo confirmar')
      return cuerpo
    },
    onSuccess: () => {
      // La fila desaparece de "falta confirmar" y reaparece más abajo en
      // "confirmados". Sin decirlo, quien no ve la pantalla solo nota que el
      // botón que acaba de tocar ya no está.
      anunciar(COPYS.anuncios.pagoConfirmado(pago.dpto, nombreMes(mes)))
      router.refresh()
    },
  })

  return (
    <div className="admin-pago">
      <div className="flex items-center gap-fila-x">
        <span className="tipo-numero-dpto w-columna-dpto">{pago.dpto}</span>
        <span className="min-w-0 flex-1">
          <span className="tipo-cuerpo-chico block truncate">{pago.nombre}</span>
          <span className="tipo-contexto-mini block text-gris admin-pago-detalle">
            {pago.estado === 'aviso' ? `avisó el ${fechaCorta(pago.fecha)}` : 'toca para registrar el pago'}
          </span>
        </span>
        <span className="tipo-monto-lista">{pago.cuota === null ? '—' : fmt(pago.cuota)}</span>
      </div>
      {pago.texto && <p className="tipo-contexto text-gris admin-pago-texto">«{pago.texto}»</p>}
      {confirmar.isError && <Fallo>{mensajeDeError(confirmar.error)}</Fallo>}
      <button
        type="button"
        onClick={() => confirmar.mutate(undefined)}
        aria-disabled={confirmar.isPending}
        aria-label={`Confirmar contra el estado de cuenta el pago del ${pago.dpto}, ${pago.nombre}`}
        className="admin-pago-boton"
      >
        {confirmar.isPending ? 'Confirmando…' : 'Confirmar contra el estado de cuenta'}
      </button>
      {/* El caso normal es pagar la cuota exacta; el botón de arriba asume eso.
          Esto es para cuando entró un monto distinto: de más queda a favor, de
          menos queda pendiente, y el balance del depto lo arrastra. */}
      <button
        type="button"
        onClick={() =>
          abrir({
            etiqueta: COPYS.pagos.otroMontoEtiqueta(pago.dpto),
            valorInicial: pago.cuota ?? undefined,
            decimales: true,
            maxDecimales: 2,
            sufijo: 'S/',
            onOk: (monto) => confirmar.mutate(monto),
          })
        }
        aria-disabled={confirmar.isPending}
        className="admin-pago-otro"
      >
        {COPYS.pagos.otroMonto}
      </button>
    </div>
  )
}
