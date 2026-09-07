import Link from 'next/link'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import type { DptoId, FilaSaldo, MesId } from '@/lib/calculo/tipos'
import type { ResumenMes } from '@/lib/datos/meses'
import { FijarContexto } from '@/components/hojas/Contexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Cifra } from '@/components/ui/Cifra'
import { TarjetaNoche } from '@/components/ui/TarjetaNoche'
import { Barras } from '@/components/graficos/Barras'
import { Sparkline } from '@/components/graficos/Sparkline'

/**
 * P4 · Historial. `03-pantallas.md`.
 *
 * El año entero del edificio: el saldo de la cuenta, el consumo de agua mes a
 * mes, y la lista para entrar a cualquiera.
 */
export function Historial({
  dpto,
  mes,
  serie,
  meses,
  m3PorMes,
}: {
  dpto: DptoId
  mes: MesId | null
  serie: readonly FilaSaldo[]
  meses: readonly ResumenMes[]
  m3PorMes: readonly { mes: MesId; corto: string; m3: number }[]
}) {
  const ultimo = serie[serie.length - 1] ?? null

  return (
    <div className="pantalla scroll-limpio con-nav">
      <FijarContexto mes={mes} dpto={dpto} />

      <div className="historial-cabecera">
        <h1 className="tipo-titulo-pantalla">{COPYS.historial.titulo}</h1>
        <p className="tipo-cuerpo-medio text-gris historial-subtitulo">{COPYS.historial.subtitulo}</p>
      </div>

      <div className="animar-entrada historial-noche">
        <TarjetaNoche>
          <Etiqueta tono="sobre-noche" className="block historial-noche-titulo">
            {COPYS.historial.laCuenta}
          </Etiqueta>
          <Cifra valor={ultimo?.saldo ?? 0} tamano="secundaria-menor" simbolo sobreNoche />
          <p className="tipo-cuerpo-menor text-sobre-noche-contexto historial-noche-nota">
            {COPYS.inicio.notaSaldo(ultimo?.delta ?? 0)}
          </p>
          <Sparkline
            puntos={serie.map((f) => f.saldo)}
            grande
            vacio={COPYS.inicio.sparklineCorta}
            titulo="Saldo de la cuenta mes a mes"
          />
        </TarjetaNoche>
      </div>

      <section className="animar-entrada historial-agua">
        <Etiqueta tono="agua" className="block historial-agua-titulo">
          {COPYS.historial.consumoEdificio}
        </Etiqueta>
        <Barras
          barras={m3PorMes.map((m) => ({ id: m.mes, etiqueta: m.corto, valor: m.m3 }))}
          destacado={mes ?? undefined}
          alto="edificio"
          sufijo="m³"
          titulo={COPYS.historial.consumoEdificio}
        />
      </section>

      <section className="animar-entrada historial-lista">
        <Etiqueta className="block historial-lista-titulo">{COPYS.historial.mesAMes}</Etiqueta>
        {[...meses].reverse().map((m) => (
          <Link key={m.mes} href={`/mes/${m.mes}`} className="historial-fila">
            <span className="min-w-0 flex-1">
              <span className="tipo-cuerpo-lista block historial-fila-mes">{m.etiqueta}</span>
              <span className="tipo-contexto-chico block text-gris">{COPYS.historial.estadoMes(m.alDia)}</span>
            </span>
            <span className="tipo-monto-lista">{m.totalMes === null ? '—' : fmt(m.totalMes)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-apagado" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ))}
      </section>
    </div>
  )
}
