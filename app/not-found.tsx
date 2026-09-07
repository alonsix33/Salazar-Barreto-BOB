import Link from 'next/link'
import { COPYS } from '@/lib/copys'

/** Una dirección que no existe. Sin culpar a nadie y con una salida. */
export default function NoEncontrado() {
  return (
    <div className="pantalla pantalla-error">
      <div className="pantalla-error-caja">
        <h1 className="tipo-titulo-pantalla">{COPYS.error.noEncontradoTitulo}</h1>
        <p className="tipo-cuerpo-chico text-gris pantalla-error-texto">
          {COPYS.error.noEncontradoTexto}
        </p>
        <Link href="/" className="cierre-boton">
          {COPYS.error.volverAInicio}
        </Link>
      </div>
    </div>
  )
}
