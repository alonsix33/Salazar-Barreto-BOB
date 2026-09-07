import Link from 'next/link'
import { COPYS } from '@/lib/copys'
import { fechaCorta } from '@/lib/formato'
import type { AvisoVisto } from '@/lib/datos/avisos'
import type { DptoId } from '@/lib/calculo/tipos'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Avatar } from '@/components/Avatar'
import { MarcarLeidos } from './MarcarLeidos'
import { EnlaceAdmin } from './EnlaceAdmin'

/**
 * P5 · Avisos. `03-pantallas.md`.
 *
 * Todo lo que se movió en el edificio, y **los siete ven lo mismo**: no hay
 * avisos privados. Sin navegación inferior; se sale con la flecha.
 *
 * Al final, el acceso a Administración, visible para todos.
 */

const ICONO: Record<string, { fondo: string; color: string; forma: 'bob' | 'agua' | 'check' | 'reloj' }> = {
  mes_publicado: { fondo: 'bg-terra-suave', color: 'text-terra-oscuro', forma: 'check' },
  pago_confirmado: { fondo: 'bg-verde-suave', color: 'text-verde', forma: 'check' },
  correccion: { fondo: 'bg-ambar-suave', color: 'text-ambar', forma: 'agua' },
  gasto_fijo: { fondo: 'bg-neutro-suave', color: 'text-gris', forma: 'reloj' },
  reasignacion: { fondo: 'bg-agua-suave', color: 'text-agua', forma: 'agua' },
  recordatorio: { fondo: 'bg-neutro-suave', color: 'text-gris', forma: 'reloj' },
}

/** Hoy, esta semana, antes. Se agrupa por cuándo, no por tipo. */
function franja(iso: string): 'hoy' | 'semana' | 'antes' {
  const dias = (Date.now() - new Date(iso).getTime()) / 86_400_000
  if (dias < 1) return 'hoy'
  if (dias < 7) return 'semana'
  return 'antes'
}

function cuando(iso: string): string {
  const fecha = new Date(iso)
  const dias = (Date.now() - fecha.getTime()) / 86_400_000
  if (dias < 1) {
    return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (dias < 2) return 'ayer'
  // `fechaCorta` y no `toLocaleDateString`: el segundo mete un punto detrás del
  // mes ("1 jul.") y en el resto de la app las fechas se escriben "1 jul".
  return fechaCorta(fecha.toISOString())
}

export function Avisos({ dpto, avisos }: { dpto: DptoId; avisos: readonly AvisoVisto[] }) {
  const grupos = [
    { titulo: COPYS.avisos.hoy, items: avisos.filter((a) => franja(a.creadoEn) === 'hoy') },
    { titulo: COPYS.avisos.estaSemana, items: avisos.filter((a) => franja(a.creadoEn) === 'semana') },
    { titulo: COPYS.avisos.antes, items: avisos.filter((a) => franja(a.creadoEn) === 'antes') },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="pantalla scroll-limpio avisos-scroll">
      <div className="avisos-barra">
        <Link href="/" className="circulo-atras" aria-label="Volver a Inicio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </Link>
        <MarcarLeidos dpto={dpto} />
      </div>

      <div className="avisos-cabecera">
        <h1 className="tipo-titulo-pantalla">{COPYS.avisos.titulo}</h1>
        <p className="tipo-cuerpo-chico text-gris avisos-subtitulo">{COPYS.avisos.subtitulo}</p>
      </div>

      <div className="avisos-lista">
        {grupos.length === 0 && <p className="tipo-cuerpo-menor text-gris avisos-vacio">{COPYS.avisos.vacio}</p>}
        {grupos.map((g) => (
          <section key={g.titulo}>
            <Etiqueta className="block avisos-grupo">{g.titulo}</Etiqueta>
            {g.items.map((a) => {
              const estilo = ICONO[a.tipo] ?? ICONO.recordatorio!
              return (
                <article key={a.id} className="animar-entrada aviso">
                  <span className={`aviso-icono ${estilo.fondo} ${estilo.color}`} aria-hidden="true">
                    {estilo.forma === 'bob' ? (
                      <Avatar tamano="aviso" />
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        {estilo.forma === 'agua' && <path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z" />}
                        {estilo.forma === 'check' && <path d="M5 13l4 4L19 7" />}
                        {estilo.forma === 'reloj' && (
                          <>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                          </>
                        )}
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-aviso aviso-titulo">
                      <h2 className="tipo-cuerpo-destacado-medio min-w-0">{a.titulo}</h2>
                      <span className="tipo-mono-marca shrink-0 text-gris-claro">{cuando(a.creadoEn)}</span>
                    </div>
                    <p className="tipo-cuerpo-menor text-gris aviso-texto">{a.detalle}</p>
                  </div>
                  {/* El punto de "sin leer" es color, y el color nunca es el
                      único portador de información (`02` §8). El texto va aparte
                      y solo lo oye el lector de pantalla: un `aria-label` sobre
                      un `<span>` sin rol no lo lee nadie —lo dice axe y es
                      cierto—, así que decoraba y no informaba. */}
                  {!a.leido && (
                    <>
                      <span className="punto bg-terra aviso-nuevo" aria-hidden="true" />
                      <span className="sr-only">Sin leer.</span>
                    </>
                  )}
                </article>
              )
            })}
          </section>
        ))}
      </div>

      <EnlaceAdmin />
    </div>
  )
}
