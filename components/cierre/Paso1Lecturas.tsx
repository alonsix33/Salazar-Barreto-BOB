'use client'

import { useState } from 'react'
import { COPYS } from '@/lib/copys'
import { DPTOS } from '@/lib/calculo/constantes'
import { fmt, fmt3 } from '@/lib/calculo/redondeo'
import { revisarLecturas } from '@/lib/calculo/correccion'
import type { PropuestaLectura } from '@/lib/calculo/correccion'
import { round2 } from '@/lib/calculo/redondeo'
import type { DptoId } from '@/lib/calculo/tipos'
import { useNumpad } from '@/components/Numpad'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'
import { AvisoBob } from './AvisoBob'
import { PropuestaCorreccion } from './PropuestaCorreccion'
import { Fallo } from '@/components/ui/Fallo'

/**
 * Paso 1 · Las lecturas. **El paso más delicado.** `04-cierre-del-mes.md`.
 *
 * Siete medidores, siete números de tres decimales. Al lado, la del mes pasado.
 * El consumo se calcula al vuelo; si supera el doble del promedio se pinta en
 * ámbar y avisa, **pero no bloquea**: el que decide es el administrador.
 *
 * La corrección de tecleo **nunca corrige sola**: propone con dos botones, y solo
 * si existe exactamente una candidata válida. Con dos o más se calla, porque
 * proponer la equivocada es peor que no proponer (`01` §8).
 */
/** Los siete ids, en el orden del edificio. `revisarLecturas` los pide así. */
const IDS = DPTOS.map((d) => d.id)

export function Paso1Lecturas({ borrador, guardar, guardando, errorGuardar, avanzar }: PropsPaso) {
  const { abrir } = useNumpad()
  const [propuesta, setPropuesta] = useState<PropuestaLectura | null>(null)

  const anteriores = borrador.lecturasAnteriores
  /**
   * Las lecturas guardadas de este mes, leídas directamente del borrador.
   *
   * No se derivan del `ResultadoMes`: al empezar el cierre no hay recibo, el mes
   * sale inválido por eso, y `dptosSinLectura` viene vacío aunque no haya ni una
   * lectura. Con esa vía el contador abría en "7 / 7" sobre un mes en blanco.
   */
  const escritas = borrador.lecturas
  const hechas = DPTOS.filter((d) => escritas[d.id] !== undefined).length

  const escribir = (dpto: DptoId) => {
    const anterior = anteriores[dpto]
    abrir({
      etiqueta:
        anterior === undefined
          ? `Lectura del ${dpto}`
          : `Lectura del ${dpto} · ${COPYS.cierre.anterior(fmt3(anterior))}`,
      valorInicial: escritas[dpto] ?? null,
      decimales: true,
      maxDecimales: 3,
      sufijo: null,
      onOk: (valor) => {
        /**
         * **Primero se guarda lo tecleado, y después se pregunta.**
         *
         * El orden importa. Al revés —proponer y esperar a que el administrador
         * elija— la lectura recién escrita se quedaba solo en la memoria del
         * navegador: cerrar la hoja o recargar en ese momento la perdía, en un
         * paso cuya promesa es «se guarda solo en cada uno». Guardar lo que el
         * administrador escribió no es corregir por él: es hacerle caso. La
         * propuesta es una oferta encima, y decir que no ya no tiene que
         * escribir nada.
         */
        void guardar('lecturas', { lecturas: { [dpto]: valor } })

        /**
         * ¿Parece un error de tecleo con una única corrección posible? La regla de
         * §8 compara contra los m³ de SEDAPAL y contra los otros seis medidores,
         * así que solo se puede evaluar con el recibo escrito y las siete lecturas
         * puestas. En el orden del cierre eso pasa **después** de este paso: aquí
         * la propuesta solo sale al reeditar una lectura al volver. Quien la
         * dispara en el recorrido normal es el paso 2.
         */
        const candidata = revisarLecturas(
          { ...escritas, [dpto]: valor },
          anteriores,
          borrador.promedios,
          borrador.resultado.rec.aguaM3,
          IDS,
        )
        if (candidata && candidata.dpto === dpto) setPropuesta(candidata)
      },
    })
  }

  const aceptarPropuesta = () => {
    if (!propuesta) return
    void guardar('lecturas', { lecturas: { [propuesta.dpto]: propuesta.valor } })
    setPropuesta(null)
  }

  const mantenerTecleado = () => {
    // Lo tecleado ya está guardado desde antes de preguntar: decir que no es
    // cerrar la pregunta, no escribir nada.
    setPropuesta(null)
  }

  const bloqueo =
    hechas === 7 ? null : hechas === 6 ? COPYS.cierre.faltaUna : COPYS.cierre.faltanVarias(7 - hechas)

  return (
    <div className="cierre-cuerpo">
      <div className="flex items-start justify-between gap-fila-x cierre-titulo-fila">
        <div className="min-w-0">
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.lecturasTitulo}</h2>
          <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.cierre.lecturasIntro}</p>
        </div>
        <span className="cierre-contador">{COPYS.cierre.contador(hechas)}</span>
      </div>

      {propuesta && (
        <PropuestaCorreccion
          propuesta={propuesta}
          aceptar={aceptarPropuesta}
          mantener={mantenerTecleado}
          ocupado={guardando}
        />
      )}

      {DPTOS.map((d) => {
        const anterior = anteriores[d.id]
        const escrita = escritas[d.id] ?? null
        const consumo = escrita !== null && anterior !== undefined ? round2(escrita - anterior) : null
        const promedio = borrador.promedios[d.id] ?? 0
        const alto = consumo !== null && promedio > 0 && consumo > promedio * 2
        return (
          <button key={d.id} type="button" onClick={() => escribir(d.id)} className="lectura-fila">
            <span className="min-w-0 flex-1 text-left">
              <span className="tipo-cuerpo-lista block">
                {d.id} <span className="text-gris">{d.nombre}</span>
              </span>
              <span className="tipo-contexto-chico block text-gris lectura-anterior">
                {anterior === undefined ? '—' : COPYS.cierre.anterior(fmt3(anterior))}
              </span>
            </span>
            <span className="text-right">
              <span className={`tipo-lectura block ${escrita === null ? 'text-apagado' : ''}`}>
                {escrita === null ? '000.000' : fmt3(escrita)}
              </span>
              <span className={`tipo-mono-etiqueta block lectura-consumo ${alto ? 'text-ambar' : 'text-agua'}`}>
                {consumo === null ? COPYS.cierre.escribirLectura : COPYS.cierre.consumo(fmt(consumo))}
              </span>
            </span>
          </button>
        )
      })}

      {DPTOS.filter((d) => {
        const anterior = anteriores[d.id]
        const escrita = escritas[d.id] ?? null
        const consumo = escrita !== null && anterior !== undefined ? round2(escrita - anterior) : null
        const promedio = borrador.promedios[d.id] ?? 0
        return consumo !== null && promedio > 0 && consumo > promedio * 2
      }).map((d) => (
        <AvisoBob key={d.id}>{COPYS.cierre.consumoAlto(d.id)}</AvisoBob>
      ))}

      {errorGuardar && <Fallo>{errorGuardar}</Fallo>}

      <BotonAvanzar onClick={avanzar} bloqueadoPor={bloqueo} cargando={guardando}>
        Continuar
      </BotonAvanzar>
    </div>
  )
}
