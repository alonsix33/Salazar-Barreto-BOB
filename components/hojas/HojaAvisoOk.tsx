'use client'

import { COPYS } from '@/lib/copys'
import { Avatar } from '@/components/Avatar'
import { Boton } from '@/components/ui/Boton'
import { Hoja } from './Hoja'
import { useHoja } from './Hojas'

/** `aviso-ok` · la confirmación de "ya pagué". `03-pantallas.md`. */
export function HojaAvisoOk() {
  const { cerrar } = useHoja()
  return (
    <Hoja titulo={COPYS.hojas.avisoOk.titulo}>
      <div className="hoja-cuerpo">
        <div className="aviso-ok-icono">
          <Avatar tamano="nav" sonrie />
        </div>
        <h2 className="tipo-titulo-hoja aviso-ok-titulo">{COPYS.hojas.avisoOk.titulo}</h2>
        <p className="tipo-cuerpo-chico text-gris aviso-ok-texto">{COPYS.hojas.avisoOk.texto}</p>
        <Boton onClick={cerrar}>Entendido</Boton>
      </div>
    </Hoja>
  )
}
