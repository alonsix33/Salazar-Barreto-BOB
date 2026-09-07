import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { etiquetaMes, nombreMes } from '@/lib/calculo/mes'
import { fechaCorta } from '@/lib/formato'
import { estadoCuota } from '@/lib/estados'
import type { DptoId, MesId, PagosMes, ResultadoMes } from '@/lib/calculo/tipos'
import { vistaAnual, type HistorialDpto } from '@/lib/datos/historial'
import { FijarContexto } from '@/components/hojas/Contexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Cifra } from '@/components/ui/Cifra'
import { PildoraEstado } from '@/components/ui/PildoraEstado'
import { TarjetaNoche } from '@/components/ui/TarjetaNoche'
import { TarjetaBlanca } from '@/components/ui/TarjetaBlanca'
import { AccionesPago } from './AccionesPago'
import { AbrirHoja } from './AbrirHoja'
import { CambiarDpto } from './CambiarDpto'
import { EnlaceAdmin } from './EnlaceAdmin'
import { ActivarAvisos } from '@/components/ActivarAvisos'

/**
 * P3 · Mi departamento. `03-pantallas.md`.
 *
 * Mi historia: la cuota del mes desglosada, el lavado si me toca, y las dos
 * tarjetas tocables con pagos y consumo.
 */
export function MiDepartamento({
  dpto,
  mes,
  resultado,
  pagos,
  historial,
  balance,
}: {
  dpto: DptoId
  mes: MesId
  resultado: ResultadoMes
  pagos: PagosMes
  historial: HistorialDpto
  /** Lo que el depto trae a favor (+) o le falta (−), acumulado. */
  balance: number
}) {
  const mia = resultado.cuotas[dpto]
  const miPago = pagos[dpto] ?? null
  const estado = estadoCuota(miPago)
  const detalle =
    estado === 'sin-registrar'
      ? COPYS.inicio.detalleSinRegistrar
      : estado === 'en-verificacion'
        ? COPYS.inicio.detalleEnVerificacion(fechaCorta(miPago!.fecha))
        : COPYS.inicio.detalleAlDia(fechaCorta(miPago!.fecha), miPago!.op ?? '—')

  // La tira ENE→DIC y los agregados «del año» se toman del año de calendario que
  // se está mirando, no de una ventana móvil de doce meses. Ver `vistaAnual`.
  const anio = Number(mes.slice(0, 4))
  const anual = vistaAnual(historial.filas, anio)
  const maximo = anual.maximoM3 || 1
  const promedio = anual.promedioM3

  const mesesConConsumo = anual.slots.filter((f) => f && f.cuota !== null).length
  const bobConsumo =
    mesesConConsumo < 3
      ? 'Todavía no tengo suficientes meses para ver un patrón.'
      : mia.m3 > promedio * 1.2
        ? `Es tu mes más alto del año, ${fmt(mia.m3 - promedio)} m³ sobre tu promedio.`
        : mia.m3 < promedio * 0.8
          ? 'Este mes consumiste bastante menos de lo habitual.'
          : 'Tu consumo está estable, cerca de tu promedio de siempre.'

  return (
    <div className="pantalla scroll-limpio con-nav">
      <FijarContexto mes={mes} dpto={dpto} />

      <div className="midpto-cabecera">
        <div className="min-w-0">
          <Etiqueta className="block midpto-etiqueta">
            {COPYS.miDpto.cabecera(historial.nombre, historial.flat)}
          </Etiqueta>
          <h1 className="tipo-titulo-grande whitespace-nowrap">{COPYS.miDpto.titulo(dpto)}</h1>
        </div>
        <CambiarDpto />
      </div>

      <div className="animar-entrada midpto-noche">
        <TarjetaNoche>
          <div className="flex items-center justify-between midpto-noche-cabecera">
            <Etiqueta tono="sobre-noche">{etiquetaMes(mes)}</Etiqueta>
            <PildoraEstado estado={estado} sobreNoche />
          </div>
          <Cifra valor={mia.total} tamano="secundaria" simbolo sobreNoche />
          <p className="tipo-cuerpo-menor text-sobre-noche-contexto midpto-noche-nota">{detalle}</p>
          {estado === 'sin-registrar' && <AccionesPago mes={mes} dpto={dpto} />}
        </TarjetaNoche>
      </div>

      <ActivarAvisos />

      {/* El balance que arrastra: a favor si pagó de más o por adelantado, o lo
          que le falta poner. En suave, sin rojo ni la palabra deuda. Al día no
          se dice nada, para no llenar de ruido. */}
      {Math.abs(balance) >= 0.01 && (
        <div className={balance > 0 ? 'midpto-balance midpto-balance-favor' : 'midpto-balance midpto-balance-falta'}>
          <span className="tipo-cuerpo-chico">
            {balance > 0 ? COPYS.miDpto.aFavor : COPYS.miDpto.leFalta}
          </span>
          <span className="tipo-monto-lista">{fmt(Math.abs(balance))}</span>
        </div>
      )}

      {mia.lavado > 0 && (
        <div className="animar-entrada midpto-lavado-contenedor">
          <TarjetaBlanca tamano="media" className="midpto-lavado">
            <div className="flex items-center justify-between midpto-lavado-cabecera">
              <Etiqueta tono="agua" tamano="pequena">
                {COPYS.miDpto.lavado}
              </Etiqueta>
              <span className="tipo-monto-lista">{fmt(mia.lavado)} m³</span>
            </div>
            <p className="tipo-cuerpo-menor text-gris midpto-lavado-texto">
              {COPYS.miDpto.explicaLavado(mia.lavado)}
            </p>
          </TarjetaBlanca>
        </div>
      )}

      <section className="animar-entrada midpto-historia">
        <Etiqueta className="block midpto-historia-titulo">{COPYS.miDpto.tuHistoria}</Etiqueta>

        <AbrirHoja hoja="pagos" className="midpto-tarjeta">
          <div className="flex items-start justify-between midpto-tarjeta-cabecera">
            <div className="min-w-0">
              <Etiqueta tamano="pequena" className="block midpto-tarjeta-etiqueta">
                {COPYS.miDpto.historialPagos}
              </Etiqueta>
              <Cifra valor={anual.totalPagado} tamano="tarjeta-media" simbolo />
              <p className="tipo-contexto text-gris midpto-tarjeta-nota">
                {COPYS.miDpto.resumenAnual(
                  anio,
                  anual.mesesAlDia,
                  anual.slots.filter((f) => f && f.cuota !== null).length,
                  anual.mesesEnVerificacion,
                )}
              </p>
            </div>
            <span className="midpto-flecha" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 4h11v11M20 4 4 20" />
              </svg>
            </span>
          </div>
          <div className="flex gap-tira">
            {anual.slots.map((fila, i) => {
              // El mes en curso (el que se está mirando) se pinta pleno; los
              // demás confirmados, en el tono tenue. `i` es el mes del calendario.
              const esActual = fila?.mes === mes
              const clase = !fila
                ? 'bg-neutro-suave'
                : fila.estado === 'confirmado'
                  ? esActual
                    ? 'bg-verde'
                    : 'bg-verde-tira'
                  : fila.estado === 'aviso'
                    ? 'bg-agua'
                    : 'bg-ambar-tira'
              return <span key={i} className={`tira-pago ${clase}`} />
            })}
          </div>
          <div className="flex justify-between midpto-eje">
            <span className="tipo-mono-eje text-gris">{COPYS.miDpto.ejeInicio}</span>
            <span className="tipo-mono-eje text-gris">{COPYS.miDpto.ejeFin}</span>
          </div>
        </AbrirHoja>

        <AbrirHoja hoja="agua" className="midpto-tarjeta">
          <div className="flex items-start justify-between midpto-tarjeta-cabecera">
            <div className="min-w-0">
              <Etiqueta tono="agua" tamano="pequena" className="block midpto-tarjeta-etiqueta">
                {COPYS.miDpto.tuConsumo}
              </Etiqueta>
              <Cifra valor={mia.m3} tamano="tarjeta-media" sufijo="m³" />
              <p className="tipo-contexto text-gris midpto-tarjeta-nota">
                {COPYS.miDpto.notaConsumo(nombreMes(mes), promedio)}
              </p>
            </div>
            <span className="midpto-flecha" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 4h11v11M20 4 4 20" />
              </svg>
            </span>
          </div>
          <div className="flex items-end gap-tira midpto-tira-agua">
            {anual.slots.map((fila, i) => {
              const esActual = fila?.mes === mes
              const tieneM3 = fila !== null && fila.cuota !== null
              return (
                <span
                  key={i}
                  className={`tira-agua ${tieneM3 ? (esActual ? 'bg-agua' : 'bg-neutro-barra') : 'bg-neutro-suave'}`}
                  style={{
                    ['--alto-tira' as string]: tieneM3
                      ? `${Math.max(11, (fila!.m3 / maximo) * 100)}%`
                      : '9%',
                  }}
                />
              )
            })}
          </div>
          <p className="tipo-cuerpo-menor text-gris midpto-bob">{bobConsumo}</p>
        </AbrirHoja>
      </section>

      <EnlaceAdmin />
    </div>
  )
}
