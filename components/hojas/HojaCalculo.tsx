'use client'

import { useQuery } from '@tanstack/react-query'
import { DPTOS } from '@/lib/calculo/constantes'
import { fmt, fmt3 } from '@/lib/calculo/redondeo'
import { etiquetaMes } from '@/lib/calculo/mes'
import type { DptoId, MesId, ResultadoMes } from '@/lib/calculo/tipos'
import { Hoja } from './Hoja'

/**
 * `calculo` · **La pieza central de la transparencia.** `03-pantallas.md`.
 *
 * Cinco secciones numeradas: lo que cobró SEDAPAL, lo que midió cada medidor,
 * qué pasó con la diferencia, lo que paga cada uno, y el cuadre.
 *
 * El principio que gobierna esta hoja está en `README` §1: *nada de "confía en
 * mí"*. Cada monto se abre y muestra de dónde sale, con los números del recibo
 * al lado.
 */
export function HojaCalculo({ mes, dpto }: { mes: MesId; dpto: DptoId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mes', mes],
    queryFn: async (): Promise<{ resultado: ResultadoMes }> => {
      const r = await fetch(`/api/meses/${mes}`)
      if (!r.ok) throw new Error('No se pudo cargar el mes')
      return r.json()
    },
  })

  return (
    <Hoja titulo="De dónde sale cada monto" altura="alta">
      <div className="hoja-cuerpo">
        <p className="tipo-etiqueta-pequena text-agua calculo-etiqueta">El agua de {etiquetaMes(mes)}</p>
        <h2 className="tipo-titulo-hoja calculo-titulo">De dónde sale cada monto</h2>
        <p className="tipo-cuerpo-chico text-gris calculo-intro">
          La suma tiene que dar exactamente lo que facturó SEDAPAL.
        </p>

        {isLoading && <p className="tipo-cuerpo-menor text-gris">Cargando el cálculo…</p>}
        {isError && (
          <p className="tipo-cuerpo-menor text-gris">
            No se pudo cargar el cálculo. Revisa la conexión y vuelve a intentarlo.
          </p>
        )}
        {data && <Secciones c={data.resultado} dpto={dpto} />}
      </div>
    </Hoja>
  )
}

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="calculo-seccion">
      <h3 className="calculo-seccion-cabecera">
        <span className="calculo-numero">{n}</span>
        <span className="tipo-cuerpo-destacado-medio">{titulo}</span>
      </h3>
      {children}
    </section>
  )
}

function Secciones({ c, dpto }: { c: ResultadoMes; dpto: DptoId }) {
  if (!c.valido) {
    return <p className="tipo-cuerpo-menor text-gris">{c.motivoInvalido}</p>
  }
  return (
    <>
      <Seccion n={1} titulo="Lo que cobró SEDAPAL">
        <div className="calculo-dos">
          <div className="calculo-dato">
            <p className="tipo-etiqueta-pequena text-gris calculo-dato-titulo">Metros cúbicos</p>
            <p className="calculo-dato-cifra">{c.rec.aguaM3}</p>
          </div>
          <div className="calculo-dato calculo-dato-derecha">
            <p className="tipo-etiqueta-pequena text-gris calculo-dato-titulo">La factura</p>
            <p className="calculo-dato-cifra">{fmt(c.facturaAgua)}</p>
          </div>
        </div>
        <p className="tipo-cuerpo-menor text-gris calculo-nota">
          Cada metro cúbico costó <span className="calculo-precio">S/ {fmt(c.precioM3)}</span>. Ese precio se
          usa para todos por igual.
        </p>
      </Seccion>

      <Seccion n={2} titulo="Lo que midió cada medidor">
        {DPTOS.map((d, i) => (
          <div key={d.id} className={`calculo-fila ${i === 0 ? 'calculo-fila-primera' : ''}`}>
            <span className={`tipo-mono-chico calculo-dpto ${d.id === dpto ? 'text-agua' : ''}`}>{d.id}</span>
            <span className="tipo-contexto-chico min-w-0 flex-1 truncate text-gris">
              {fmt3(c.cuotas[d.id].lecturaAnterior)} → {fmt3(c.cuotas[d.id].lecturaActual)}
            </span>
            <span className="tipo-mono-etiqueta">{fmt(c.consumos[d.id])}</span>
          </div>
        ))}
        <div className="calculo-suman">
          <span className="tipo-cuerpo-destacado-medio flex-1">Suman</span>
          <span className="tipo-monto-fila">{fmt(c.sumaMedida)} m³</span>
        </div>
      </Seccion>

      <Seccion n={3} titulo={c.ajustado ? 'Por qué se ajustó' : 'Qué pasó con la diferencia'}>
        <p className="tipo-cuerpo-chico text-gris calculo-explicacion">
          {c.ajustado
            ? `Los medidores midieron ${fmt(c.sumaMedida)} m³ pero SEDAPAL facturó ${c.rec.aguaM3}. SEDAPAL lee unos días antes que nosotros, así que este ciclo nuestros medidores contaron días que el recibo todavía no incluye. Como no se puede cobrar más de lo que llegó, a cada uno se le descuenta la misma proporción.`
            : `Sobran ${fmt(c.brutoComun)} m³ que pasaron por el caño común.`}
        </p>
        {!c.ajustado && (
          <div className="calculo-cajas">
            {c.lavado > 0 && (
              <div className="calculo-caja calculo-caja-agua">
                <p className="calculo-caja-cifra">{fmt(c.lavado)}</p>
                <p className="tipo-contexto-mini calculo-caja-nota">del lavado de vehículo, van al 401</p>
              </div>
            )}
            <div className="calculo-caja calculo-caja-neutra">
              <p className="calculo-caja-cifra">{fmt(c.comunReal)}</p>
              <p className="tipo-contexto-mini text-gris calculo-caja-nota">
                área común, se reparte entre los siete
              </p>
            </div>
          </div>
        )}
      </Seccion>

      <Seccion n={4} titulo="Lo que paga cada uno">
        {DPTOS.map((d, i) => {
          const q = c.cuotas[d.id]
          const propio = d.id === dpto
          return (
            <div
              key={d.id}
              className={`calculo-fila ${i === 0 ? 'calculo-fila-primera' : ''} ${propio ? 'calculo-fila-propia' : ''}`}
            >
              <span className={`tipo-mono-chico calculo-dpto ${propio ? 'text-agua' : ''}`}>{d.id}</span>
              <span className="tipo-contexto-chico min-w-0 flex-1 truncate text-gris">
                {q.lavado
                  ? `${fmt(q.m3medidos)} + ${fmt(q.lavado)} = ${fmt(q.m3)} m³`
                  : `${fmt(q.m3)} m³ × ${fmt(c.precioM3)}`}
              </span>
              <span className="tipo-mono-etiqueta">{fmt(q.agua)}</span>
            </div>
          )
        })}
        {!c.ajustado && (
          <div className="calculo-fila calculo-fila-comun">
            <span className="tipo-contexto min-w-0 flex-1 truncate text-gris">
              Área común · {fmt(c.comunReal)} m³
            </span>
            <span className="tipo-mono-etiqueta text-gris">{fmt(c.montoComun)}</span>
          </div>
        )}
      </Seccion>

      <div className={c.cuadraAgua ? 'calculo-cuadre' : 'calculo-cuadre calculo-cuadre-falla'}>
        <h3 className="calculo-cuadre-cabecera">
          <span className={c.cuadraAgua ? 'calculo-cuadre-icono' : 'calculo-cuadre-icono calculo-cuadre-icono-falla'}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              {c.cuadraAgua ? <path d="M5 13l4 4L19 7" /> : <path d="M12 8v5M12 16.5h.01" />}
            </svg>
          </span>
          <span className="tipo-cuerpo-destacado-medio">{c.cuadraAgua ? 'El cuadre' : 'Esto no cuadra'}</span>
        </h3>
        <div className="calculo-cuadre-fila">
          <span className="tipo-cuerpo-menor">Los siete departamentos</span>
          <span className="tipo-mono-etiqueta">{fmt(c.sumaAgua)}</span>
        </div>
        <div className="calculo-cuadre-fila">
          <span className="tipo-cuerpo-menor">El área común</span>
          <span className="tipo-mono-etiqueta">{c.ajustado ? '—' : fmt(c.montoComun)}</span>
        </div>
        <div className="calculo-cuadre-total">
          <span className="tipo-cuerpo-destacado-medio">La factura de SEDAPAL</span>
          <span className="calculo-cuadre-cifra">{fmt(c.facturaAgua)}</span>
        </div>
      </div>
    </>
  )
}
