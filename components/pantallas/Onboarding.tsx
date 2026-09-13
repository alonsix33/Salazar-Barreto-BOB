import { DPTOS } from '@/lib/calculo/constantes'
import { COPYS } from '@/lib/copys'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { elegirDepartamento } from '@/app/acciones'

/**
 * P0 · Elegir departamento. `03-pantallas.md`.
 *
 * Primer uso. Sin navegación inferior. La elección se guarda en el dispositivo.
 * Los departamentos van dibujados como el edificio, de arriba abajo, porque así
 * el vecino encuentra el suyo mirando en vez de leyendo.
 */

/** Los pisos, de arriba abajo, como se ven desde la calle. */
const PISOS: readonly (readonly string[])[] = [['501', '502'], ['401'], ['301'], ['201', '202'], ['101']]

export function Onboarding() {
  return (
    <div className="pantalla scroll-limpio flex flex-col">
      <div className="onboarding-cabecera">
        <Etiqueta tono="terra" className="block onboarding-marca">
          {COPYS.onboarding.marca}
        </Etiqueta>
        <h1 className="tipo-titulo-hoja onboarding-titulo">{COPYS.onboarding.titulo}</h1>
        <p className="tipo-cuerpo text-gris onboarding-subtitulo">{COPYS.onboarding.subtitulo}</p>
      </div>

      <form action={elegirDepartamento} className="onboarding-edificio">
        <div className="onboarding-techo" aria-hidden="true" />
        {PISOS.map((piso) => (
          <div key={piso.join('-')} className="onboarding-piso" data-columnas={piso.length}>
            {piso.map((id) => {
              const dpto = DPTOS.find((d) => d.id === id)!
              return (
                <button key={id} type="submit" name="dpto" value={id} className="onboarding-dpto">
                  <span className="tipo-numero-dpto">{id}</span>
                  {/* El nombre completo: en un departamento vive más de una
                      persona, y ver solo a una es raro para quien vive ahí. */}
                  <span className="tipo-contexto-mini text-gris onboarding-dpto-nombre">
                    {dpto.nombre}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </form>
    </div>
  )
}
