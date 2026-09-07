import { DPTOS } from '@/lib/calculo/constantes'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { etiquetaMes, nombreMes } from '@/lib/calculo/mes'
import { fechaCorta } from '@/lib/formato'
import type { DptoId, MesId, PagosMes, ResultadoMes } from '@/lib/calculo/tipos'
import type { ResumenMes } from '@/lib/datos/meses'
import { FijarContexto } from '@/components/hojas/Contexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Cifra } from '@/components/ui/Cifra'
import { TarjetaNoche } from '@/components/ui/TarjetaNoche'
import { TarjetaBlanca } from '@/components/ui/TarjetaBlanca'
import { FilaDivisoria } from '@/components/ui/FilaDivisoria'
import { Barras } from '@/components/graficos/Barras'
import { SelectorMeses } from './SelectorMeses'
import { AbrirCalculo } from './AbrirCalculo'

/**
 * P2 · El mes. `03-pantallas.md`.
 *
 * En qué se gastó y cómo se repartió. La rejilla del agua es asimétrica a
 * propósito: el gráfico manda, los dos datos del recibo acompañan.
 */
export function ElMes({
  dpto,
  mes,
  resultado,
  anterior,
  pagos,
  meses,
}: {
  dpto: DptoId
  mes: MesId
  resultado: ResultadoMes
  anterior: ResultadoMes | null
  pagos: PagosMes
  meses: readonly ResumenMes[]
}) {
  const diferencia =
    anterior && anterior.valido ? Math.round((resultado.totalMes - anterior.totalMes) * 100) / 100 : null

  const explicacion = resultado.ajustado
    ? COPYS.mes.explicaAjustado(resultado.sumaMedida, resultado.rec.aguaM3)
    : resultado.lavado > 0
      ? COPYS.mes.explicaNormalConLavado(
          resultado.sumaMedida, resultado.rec.aguaM3, resultado.lavado, resultado.comunReal,
        )
      : COPYS.mes.explicaNormalSinLavado(resultado.sumaMedida, resultado.rec.aguaM3, resultado.comunReal)

  const confirmados = DPTOS.filter((d) => pagos[d.id]?.estado === 'confirmado')

  return (
    <div className="pantalla scroll-limpio con-nav">
      <FijarContexto mes={mes} dpto={dpto} />
      <div className="mes-titulo">
        <h1 className="tipo-titulo-pantalla">{COPYS.mes.titulo}</h1>
      </div>

      <SelectorMeses meses={meses} activo={mes} />

      <div className="animar-entrada mes-noche">
        <TarjetaNoche>
          <Etiqueta tono="sobre-noche" className="block mes-noche-titulo">
            {COPYS.mes.costoTotal}
          </Etiqueta>
          <Cifra valor={resultado.totalMes} tamano="secundaria" simbolo sobreNoche />
          <p className="tipo-cuerpo-menor text-sobre-noche-contexto mes-noche-nota">
            {etiquetaMes(mes)} · {diferencia === null ? COPYS.mes.sinComparacion : COPYS.mes.comparacion(diferencia)}
          </p>
        </TarjetaNoche>
      </div>

      {/* Rejilla asimétrica del agua. `min-width: 0` en los dos lados: sin eso
          se desborda por debajo de 340px. */}
      <div className="animar-entrada mes-rejilla">
        <TarjetaBlanca tamano="media" className="mes-grafico">
          <Etiqueta tono="agua" tamano="pequena" className="block mes-grafico-titulo">
            {COPYS.mes.consumoPorDpto}
          </Etiqueta>
          <Barras
            barras={DPTOS.map((d) => ({ id: d.id, etiqueta: d.id, valor: resultado.cuotas[d.id].m3 }))}
            destacado={dpto}
            sufijo="m³"
            titulo={COPYS.mes.consumoPorDpto}
          />
        </TarjetaBlanca>
        <div className="mes-columna">
          <TarjetaBlanca tamano="media" className="mes-dato">
            <Etiqueta tamano="pequena" className="block mes-dato-titulo">
              {COPYS.mes.aguaSedapal}
            </Etiqueta>
            <p className="tipo-cifra-tarjeta-chica mes-dato-cifra">{resultado.rec.aguaM3}</p>
            <p className="tipo-contexto-mini text-gris mes-dato-nota">{COPYS.mes.m3DelEdificio}</p>
          </TarjetaBlanca>
          <TarjetaBlanca tamano="media" className="mes-dato">
            <Etiqueta tamano="pequena" className="block mes-dato-titulo">
              {COPYS.mes.facturaAgua}
            </Etiqueta>
            <p className="tipo-cifra-tarjeta-chica mes-dato-cifra">{fmt(resultado.facturaAgua)}</p>
            <p className="tipo-contexto-mini text-gris mes-dato-nota">
              {resultado.ajustado ? COPYS.mes.notaComunAjustado : COPYS.mes.notaComun(resultado.comunReal)}
            </p>
          </TarjetaBlanca>
        </div>
      </div>

      <AbrirCalculo explicacion={explicacion} />

      <section className="animar-entrada mes-seccion">
        <Etiqueta className="block mes-seccion-titulo">{COPYS.mes.gastosDe(nombreMes(mes))}</Etiqueta>
        {resultado.gastos.map((g) => (
          <FilaDivisoria key={g.concepto} alta className="justify-between">
            <span className={`tipo-cuerpo-medio flex min-w-0 items-center gap-etiqueta ${g.porConfirmar ? 'text-gris' : ''}`}>
              <span className="truncate">{g.concepto}</span>
              {g.anual && <span className="tipo-etiqueta-anual etiqueta-anual">{COPYS.mes.anual}</span>}
            </span>
            <span className={g.porConfirmar ? 'tipo-cuerpo-enlace text-ambar' : 'tipo-monto-lista'}>
              {g.porConfirmar ? COPYS.mes.porConfirmar : fmt(g.monto)}
            </span>
          </FilaDivisoria>
        ))}
        <div className="flex items-center justify-between mes-total">
          <span className="tipo-cuerpo-destacado-medio">{COPYS.mes.total}</span>
          <Cifra valor={resultado.totalMes} tamano="destacado" />
        </div>
      </section>

      <section className="animar-entrada mes-seccion">
        <Etiqueta className="block mes-seccion-titulo">{COPYS.mes.las7Cuotas}</Etiqueta>
        {DPTOS.map((d) => {
          const q = resultado.cuotas[d.id]
          return (
            <FilaDivisoria key={d.id}>
              <span className="tipo-numero-dpto w-columna-dpto">{d.id}</span>
              <span className="tipo-contexto-chico min-w-0 flex-1 truncate text-gris">
                {COPYS.mes.desglose(q.mantenimiento, q.agua)}
              </span>
              <span className="tipo-monto-lista">{fmt(q.total)}</span>
            </FilaDivisoria>
          )
        })}
      </section>

      <section className="animar-entrada mes-seccion mes-seccion-final">
        <Etiqueta className="block mes-seccion-titulo">{COPYS.mes.pagosRecibidos}</Etiqueta>
        {confirmados.length === 0 ? (
          <p className="tipo-cuerpo-menor text-gris mes-sin-pagos">{COPYS.mes.sinPagos}</p>
        ) : (
          confirmados.map((d) => (
            <FilaDivisoria key={d.id}>
              <span className="tipo-numero-dpto w-columna-dpto">{d.id}</span>
              <span className="tipo-contexto min-w-0 flex-1 truncate text-gris">
                {COPYS.mes.detallePago(fechaCorta(pagos[d.id]!.fecha), pagos[d.id]!.op ?? '—')}
              </span>
              <span className="tipo-monto-lista">{fmt(resultado.cuotas[d.id].total)}</span>
            </FilaDivisoria>
          ))
        )}
      </section>
    </div>
  )
}

