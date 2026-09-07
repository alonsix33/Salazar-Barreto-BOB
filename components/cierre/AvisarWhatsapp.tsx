'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'

/**
 * «Avísales a los demás»: un mensaje listo para que el admin lo copie y lo pegue
 * en el grupo de WhatsApp, o lo abra directo con el botón.
 *
 * No manda nada solo: es la persona quien avisa. El push (cuando esté) es aparte;
 * esto funciona hoy, sin infraestructura, que es lo que un edificio de siete
 * vecinos con un grupo ya usa.
 */
export function AvisarWhatsapp({ mensaje }: { mensaje: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Algunos navegadores niegan el portapapeles sin gesto o sin HTTPS. El
      // mensaje está a la vista igual, así que se puede seleccionar a mano.
    }
  }

  const enlace = `https://wa.me/?text=${encodeURIComponent(mensaje)}`

  return (
    <div className="avisar">
      <p className="tipo-etiqueta-seccion text-gris avisar-titulo">{COPYS.avisar.titulo}</p>
      <p className="tipo-cuerpo-chico avisar-mensaje">{mensaje}</p>
      <div className="avisar-acciones">
        <button type="button" onClick={copiar} className="avisar-copiar">
          {copiado ? COPYS.avisar.copiado : COPYS.avisar.copiar}
        </button>
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="avisar-wa">
          {COPYS.avisar.whatsapp}
        </a>
      </div>
    </div>
  )
}

/** La URL pública de la app, para que el mensaje lleve un enlace. */
export function urlApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? ''
}
