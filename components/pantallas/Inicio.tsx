import Link from 'next/link'
import { DPTOS } from '@/lib/calculo/constantes'
import { COPYS } from '@/lib/copys'
import { estadoCuota } from '@/lib/estados'
import { fmt } from '@/lib/calculo/redondeo'
import { etiquetaMes, nombreMes } from '@/lib/calculo/mes'
import { fechaCorta } from '@/lib/formato'
import type { DptoId, FilaSaldo, MesId, PagosMes, ResultadoMes } from '@/lib/calculo/tipos'
import { FijarContexto } from '@/components/hojas/Contexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Cifra } from '@/components/ui/Cifra'
import { CifraContada } from '@/components/ui/CifraContada'
import { PildoraEstado } from '@/components/ui/PildoraEstado'
import { TarjetaNoche } from '@/components/ui/TarjetaNoche'
import { TarjetaBlanca } from '@/components/ui/TarjetaBlanca'
import { FilaDivisoria } from '@/components/ui/FilaDivisoria'
import { BarraSegmentada } from '@/components/graficos/BarraSegmentada'
import { Sparkline } from '@/components/graficos/Sparkline'
import { Campana } from './Campana'
import { AccionesCuota } from './AccionesCuota'
import { LineaBob } from './LineaBob'

/**
 * P1 · Inicio. **La pantalla que define todo.** `03-pantallas.md`.
 *
 * Responde en cinco segundos: *cuánto debo* y *cómo va el edificio*.
 *
 * Un solo bloque noche —la cuota— porque es lo que el ojo tiene que buscar
 * primero. El degradado terracota de la cabecera aparece **solo aquí**.
 */

export function Inicio({
  dpto,
  mes,
  resultado,
  pagos,
  saldo,
  serieSaldo,
  sinLeer,
}: {
  dpto: DptoId
  mes: MesId
  resultado: ResultadoMes
  pagos: PagosMes
  saldo: FilaSaldo | null
  serieSaldo: readonly FilaSaldo[]
  sinLeer: number
}) {
  const mia = resultado.cuotas[dpto]
  const miPago = pagos[dpto] ?? null
  const estado = estadoCuota(miPago)

  const confirmados = DPTOS.filter((d) => pagos[d.id]?.estado === 'confirmado')
  const avisados = DPTOS.filter((d) => pagos[d.id]?.estado === 'aviso')
  const sinRegistrar = DPTOS.filter((d) => !pagos[d.id])

  const grupos = [
    { titulo: COPYS.inicio.grupoAlDia, dptos: confirmados, estado: 'al-dia' as const },
    { titulo: COPYS.inicio.grupoAvisaron, dptos: avisados, estado: 'en-verificacion' as const },
    { titulo: COPYS.inicio.grupoSinAviso, dptos: sinRegistrar, estado: 'sin-registrar' as const },
  ].filter((g) => g.dptos.length > 0)

  const detalle =
    estado === 'sin-registrar'
      ? COPYS.inicio.detalleSinRegistrar
      : estado === 'en-verificacion'
        ? COPYS.inicio.detalleEnVerificacion(fechaCorta(miPago!.fecha))
        : COPYS.inicio.detalleAlDia(fechaCorta(miPago!.fecha), miPago!.op ?? '—')

  const conMonto = resultado.gastos.filter((g) => g.monto).sort((a, b) => (b.monto ?? 0) - (a.monto ?? 0))
  const mayor = conMonto[0]?.monto ?? 1
  const cuatro = conMonto.slice(0, 4)

  return (
    <div className="pantalla pantalla-desde-arriba scroll-limpio con-nav">
      <FijarContexto mes={mes} dpto={dpto} />
      {/* 1 · Cabecera con degradado. Solo aquí. */}
      <header className="degradado-cabecera inicio-cabecera">
        <div className="inicio-cabecera-interior">
          <div className="min-w-0">
            <Etiqueta tono="terra" className="block inicio-mes">
              {etiquetaMes(mes)}
            </Etiqueta>
            <h1 className="tipo-titulo-pantalla whitespace-nowrap">{COPYS.inicio.saludo(dpto)}</h1>
          </div>
          <Campana sinLeer={sinLeer} />
        </div>
      </header>

      {/* 2 · Tarjeta noche · tu cuota */}
      <div className="animar-entrada px-tarjetas">
        <TarjetaNoche className="inicio-cuota">
          <div className="flex items-center justify-between inicio-cuota-cabecera">
            <Etiqueta tono="sobre-noche" className="whitespace-nowrap">
              {COPYS.inicio.tuCuota(nombreMes(mes))}
            </Etiqueta>
            <PildoraEstado estado={estado} sobreNoche />
          </div>
          <CifraContada valor={mia.total} tamano="protagonista" simbolo sobreNoche className="inicio-cuota-monto" />
          <p className="tipo-cuerpo-menor text-sobre-noche-contexto inicio-cuota-detalle">{detalle}</p>
          <div className="inicio-desglose">
            <div className="flex justify-between inicio-desglose-fila inicio-desglose-linea">
              <span className="tipo-cuerpo-destacado text-sobre-noche-cuerpo">{COPYS.inicio.mantenimiento}</span>
              <span className="tipo-monto-lista">{fmt(mia.mantenimiento)}</span>
            </div>
            <div className="flex justify-between inicio-desglose-fila">
              <span className="tipo-cuerpo-destacado text-agua-claro whitespace-nowrap">
                {COPYS.inicio.consumoAgua(mia.m3)}
              </span>
              <span className="tipo-monto-lista">{fmt(mia.agua)}</span>
            </div>
            {/* El valor sale del cálculo. Si el admin lo cambia a 3, dice 3.00. */}
            {mia.lavado > 0 && (
              <p className="tipo-contexto-chico text-sobre-noche-terciario inicio-lavado">
                {COPYS.inicio.incluyeLavado(mia.lavado)}
              </p>
            )}
          </div>
          <AccionesCuota />
        </TarjetaNoche>
      </div>

      <LineaBob
        avisados={avisados.map((d) => d.id)}
        sinRegistrar={sinRegistrar.map((d) => d.id)}
        mes={mes}
      />

      {/* 3 · Los 7 este mes */}
      <section className="animar-entrada inicio-seccion-7">
        <div className="flex items-baseline justify-between inicio-titulo-7">
          <Etiqueta>{COPYS.inicio.los7}</Etiqueta>
          <span className="tipo-mono-mini">
            {COPYS.inicio.resumenPagos(confirmados.length, avisados.length)}
          </span>
        </div>
        <BarraSegmentada
          estados={[
            ...confirmados.map(() => 'al-dia' as const),
            ...avisados.map(() => 'en-verificacion' as const),
            ...sinRegistrar.map(() => 'sin-registrar' as const),
          ]}
          resumen={`${confirmados.length} de 7 al día, ${avisados.length} en verificación, ${sinRegistrar.length} sin registrar`}
        />
        <div className="inicio-grupos">
          {grupos.map((g) => (
            <div key={g.titulo} className="inicio-grupo">
              <p className="tipo-subtitulo-grupo text-gris inicio-grupo-titulo">{g.titulo}</p>
              {g.dptos.map((d) => {
                const propio = d.id === dpto
                return (
                  <FilaDivisoria key={d.id} className={propio ? 'realce-propio fila-propia' : ''}>
                    <span className={`tipo-numero-dpto w-columna-dpto ${propio ? 'text-terra' : ''}`}>{d.id}</span>
                    <span
                      className={`tipo-cuerpo-chico min-w-0 flex-1 truncate ${propio ? 'text-tinta' : 'text-gris'}`}
                    >
                      {propio ? COPYS.inicio.tuDepartamento : d.nombre}
                    </span>
                    <span className="tipo-monto-lista-chico">{fmt(resultado.cuotas[d.id].total)}</span>
                    <span className={`punto ${PUNTO[g.estado]}`} aria-hidden="true" />
                  </FilaDivisoria>
                )
              })}
            </div>
          ))}
        </div>
        <ul className="flex gap-leyenda inicio-leyenda">
          {[
            [COPYS.inicio.leyendaAlDia, 'bg-verde'],
            [COPYS.inicio.leyendaPorConfirmar, 'bg-agua'],
            [COPYS.inicio.leyendaSinAviso, 'bg-ambar'],
          ].map(([texto, color]) => (
            <li key={texto} className="flex items-center gap-punto">
              <span className={`punto ${color}`} aria-hidden="true" />
              <span className="tipo-contexto-mini text-gris">{texto}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 · En qué se gastó */}
      <section className="animar-entrada inicio-seccion-gastos">
        <Etiqueta className="block inicio-titulo-gastos">{COPYS.inicio.enQueSeGasto}</Etiqueta>
        <div className="flex flex-col gap-gasto">
          {cuatro.map((g) => (
            <div key={g.concepto}>
              <div className="flex justify-between inicio-gasto-fila gap-fila-x">
                {/* `min-w-0 truncate` + `shrink-0`: sin esto un concepto largo empuja
                    el monto fuera del marco, y como `.marco-app` recorta con
                    `overflow:hidden`, el número desaparece sin dejar barra de
                    scroll — ningún chequeo de `scrollWidth` lo ve. ElMes ya lo
                    hacía; esta fila se había olvidado. */}
                <span className="tipo-cuerpo-chico min-w-0 truncate">
                  {g.esAgua ? COPYS.inicio.facturaAguaCon(resultado.rec.aguaM3) : g.concepto}
                </span>
                <span className="tipo-monto-lista-chico shrink-0">{fmt(g.monto)}</span>
              </div>
              <div className="barra-gasto-pista">
                <span
                  className={`barra-gasto ${g.esAgua ? 'bg-agua' : g.monto === mayor ? 'bg-terra' : 'bg-terra-media'}`}
                  style={{ ['--ancho-gasto' as string]: `${((g.monto ?? 0) / mayor) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <Link href="/mes" className="flex items-center justify-between inicio-total">
          <span className="tipo-cuerpo-enlace text-gris">
            {COPYS.inicio.restoGastos(Math.max(0, conMonto.length - 4))}
          </span>
          <span className="tipo-monto-fila">{fmt(resultado.totalMes)}</span>
        </Link>
      </section>

      {/* 5 · La cuenta */}
      <section className="animar-entrada inicio-seccion-cuenta">
        <TarjetaBlanca className="inicio-cuenta">
          <Etiqueta className="block inicio-cuenta-titulo">{COPYS.inicio.laCuenta}</Etiqueta>
          <Cifra valor={saldo?.saldo ?? 0} tamano="tarjeta" simbolo />
          <p className="tipo-contexto text-gris inicio-cuenta-nota">
            {COPYS.inicio.notaSaldo(saldo?.delta ?? 0)}
          </p>
          <Sparkline
            puntos={serieSaldo.map((f) => f.saldo)}
            vacio={COPYS.inicio.sparklineCorta}
            titulo="Saldo de la cuenta mes a mes"
          />
          <div className="flex inicio-cuenta-pie">
            <div className="flex-1 inicio-cuenta-columna">
              <Etiqueta tamano="pequena" className="block inicio-cuenta-etiqueta">
                {COPYS.inicio.recibido}
              </Etiqueta>
              <Cifra valor={saldo?.recibido ?? 0} tamano="columna" />
            </div>
            <div className="flex-1 inicio-cuenta-columna-derecha">
              <Etiqueta tamano="pequena" className="block inicio-cuenta-etiqueta">
                {COPYS.inicio.gastado}
              </Etiqueta>
              <Cifra valor={saldo?.gastado ?? 0} tamano="columna" />
            </div>
          </div>
        </TarjetaBlanca>
      </section>
    </div>
  )
}

const PUNTO = {
  'al-dia': 'bg-verde',
  'en-verificacion': 'bg-agua',
  'sin-registrar': 'bg-ambar',
} as const
