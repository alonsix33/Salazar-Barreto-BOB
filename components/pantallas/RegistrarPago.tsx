'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
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
 *
 * Si `pago.estado` ya es `'confirmado'` al montar —`HojaPagosPasados` pasa
 * los siete departamentos de un mes elegido, confirmados o no—, no hay botón
 * que mostrar: un aviso, del mismo tamaño, en vez de un botón que el
 * servidor iba a rechazar.
 */
export function RegistrarPago({ pago, mes }: { pago: FilaPago; mes: MesId }) {
  const router = useRouter()
  const queryClient = useQueryClient()
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
      /**
       * `router.refresh()` re-pinta al `PanelAdmin` de siempre —recibe
       * `datos` como prop de un Server Component—, pero `HojaPagosPasados`
       * trae el suyo con `useQuery(['mes', mes], …)`, en el cliente, y
       * `router.refresh()` no lo toca. Sin esto, tras confirmar, la fila
       * seguía mostrando el botón de "confirmar" con los mismos datos
       * viejos: quien administraba lo tocaba de nuevo, y recién en el
       * segundo toque el servidor contestaba "ese pago ya estaba
       * confirmado" —la confirmación sí había funcionado la primera vez,
       * solo que nada en pantalla lo decía—.
       */
      void queryClient.invalidateQueries({ queryKey: ['mes', mes] })
    },
  })

  return (
    <div className="admin-pago">
      <div className="flex items-center gap-fila-x">
        <span className="tipo-numero-dpto w-columna-dpto">{pago.dpto}</span>
        <span className="min-w-0 flex-1">
          <span className="tipo-cuerpo-chico block truncate">{pago.nombre}</span>
          {/*
           * Antes de `HojaPagosPasados`, `RegistrarPago` solo recibía pagos
           * en `'aviso'` o sin nada (`PanelAdmin` manda los `'confirmado'`
           * por otra vía, sin este componente): un dos-vías bastaba. Ahora
           * `HojaPagosPasados` manda los siete departamentos de un mes,
           * confirmados incluidos, y con dos vías un pago ya confirmado caía
           * en el "toca para registrar el pago" —justo encima del aviso
           * verde de abajo que dice lo contrario—. El aviso verde ya dice
           * cuándo se confirmó; esta línea no tiene nada que añadir ahí.
           */}
          {pago.estado !== 'confirmado' && (
            <span className="tipo-contexto-mini block text-gris admin-pago-detalle">
              {pago.estado === 'aviso' ? `avisó el ${fechaCorta(pago.fecha)}` : 'toca para registrar el pago'}
            </span>
          )}
        </span>
        <span className="tipo-monto-lista">{pago.cuota === null ? '—' : fmt(pago.cuota)}</span>
      </div>
      {pago.texto && <p className="tipo-contexto text-gris admin-pago-texto">«{pago.texto}»</p>}
      {pago.estado === 'confirmado' ? (
        <p className="admin-pago-confirmado tipo-cuerpo-chico">
          {COPYS.pagos.confirmadoEl(fechaCorta(pago.fecha))}
        </p>
      ) : (
        <>
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
          {/* El caso normal es pagar la cuota exacta; el botón de arriba asume
              eso. Esto es para cuando entró un monto distinto: de más queda a
              favor, de menos queda pendiente, y el balance del depto lo
              arrastra. */}
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
        </>
      )}
    </div>
  )
}
