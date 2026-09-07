'use client'

import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { Hoja } from '@/components/hojas/Hoja'
import { TarjetaNoche } from '@/components/ui/TarjetaNoche'
import { AvisarWhatsapp, urlApp } from './AvisarWhatsapp'

/** La pantalla de confirmación del paso 7. `04-cierre-del-mes.md`. */
export function Publicado({
  mes,
  total,
  cuadra,
  onVolver,
}: {
  mes: string
  total: number
  cuadra: boolean
  onVolver: () => void
}) {
  return (
    <Hoja titulo={COPYS.cierre.publicado(mes)} altura="alta">
      <div className="cierre-cuerpo publicado">
        <span className="publicado-icono" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <h2 className="tipo-titulo-hoja publicado-titulo">{COPYS.cierre.publicado(mes)}</h2>
        <p className="tipo-cuerpo-chico text-gris publicado-nota">{COPYS.cierre.publicadoTexto}</p>
        {/* La tarjeta noche que el prototipo pone en esta pantalla: el total del
            mes, que es lo que el ojo busca primero al cerrar el flujo. `02` §4.1.
            La versión anterior la había perdido, dejando todo sobre crema. */}
        <TarjetaNoche className="publicado-noche">
          <p className="tipo-etiqueta-seccion text-sobre-noche-etiqueta publicado-noche-mes">
            {mes.toUpperCase()}
          </p>
          <p className="publicado-total">
            <span className="tipo-simbolo text-sobre-noche-terciario">S/</span>
            <span className="tipo-cifra-secundaria-menor">{fmt(total)}</span>
          </p>
          <p className="tipo-cuerpo-chico text-sobre-noche-contexto publicado-noche-nota">
            repartido entre los siete{cuadra ? ' · el agua cuadró exacto' : ''}
          </p>
        </TarjetaNoche>
        <AvisarWhatsapp mensaje={COPYS.avisar.mensajePublicado(mes, fmt(total), urlApp())} />
        <button type="button" onClick={onVolver} className="cierre-boton">
          {COPYS.cierre.volverAlPanel}
        </button>
      </div>
    </Hoja>
  )
}
