'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { COPYS } from '@/lib/copys'
import { DPTOS } from '@/lib/calculo/constantes'
import { huellaDeExtras } from '@/lib/calculo/extras'
import { etiquetaMes, nombreMes } from '@/lib/calculo/mes'
import { fmt, fmt3, round2 } from '@/lib/calculo/redondeo'
import type { DptoId, Extra, MesId, ResultadoMes } from '@/lib/calculo/tipos'
import type { DatosDeCorreccion } from '@/lib/datos/meses'
import type { CorreccionHecha } from '@/lib/servicios/cierre'
import { useNumpad } from '@/components/Numpad'
import { useAnuncio } from '@/components/Anuncio'
import { AvisarWhatsapp, urlApp } from '@/components/cierre/AvisarWhatsapp'
import { CampoNumerico } from '@/components/cierre/CampoNumerico'
import { EditorExtras } from '@/components/cierre/EditorExtras'
import { FilaFijo } from '@/components/cierre/FilaFijo'
import { Hoja } from './Hoja'
import { useHoja } from './Hojas'
import { Fallo } from '@/components/ui/Fallo'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * Corregir un mes ya publicado. `04-cierre-del-mes.md`.
 *
 * El recorrido es el de quien corrige: **qué mes → qué parte del mes → los
 * cambios → revisar lo que pasaría → guardar y avisar**. Antes solo cabían las
 * lecturas, y un gasto que llegaba después de cerrar el mes —S/ 450 de octubre,
 * ya cerrado— no tenía dónde entrar.
 *
 * Se puede tocar más de una parte antes de guardar: es **una** corrección, con
 * un motivo y un aviso. Nada va al servidor hasta el último paso, y ese paso
 * enseña, vecino por vecino, de cuánto a cuánto cambia la cuota y a quién le
 * queda algo por poner. Esa vista previa la calcula el servidor con el mismo
 * código que guarda, así que no puede prometer unas cifras y guardar otras.
 *
 * **No hay correcciones silenciosas.** Al guardar se recalculan las cuotas, se
 * avisa a los siete con qué cambió y queda en el registro de auditoría. Por eso
 * el motivo es obligatorio: lo van a leer los siete.
 *
 * Y se puede corregir **cualquier** mes publicado, no solo el último.
 */

type Parte = 'lecturas' | 'recibo' | 'fijos' | 'puntuales' | 'lavado'
type Vista = 'mes' | 'que' | Parte | 'revision'

/** Lo que se va cambiando. Todo vacío = nada que guardar. */
interface Cambios {
  lecturas: Partial<Record<DptoId, number>>
  recibo: { aguaM3?: number; aguaMonto?: number; luz?: number; descuento?: number | null }
  /** Por concepto, con **todos** sus campos tal como quedarían. */
  fijos: Record<string, { monto: number | null; anual: boolean; activo: boolean }>
  /** La lista entera como quedaría; `null` si no se tocó. */
  extras: Extra[] | null
  lavado: boolean | null
}

const SIN_CAMBIOS: Cambios = { lecturas: {}, recibo: {}, fijos: {}, extras: null, lavado: null }

export function HojaCorregir({
  publicados,
}: {
  publicados: readonly { mes: MesId; etiqueta: string }[]
}) {
  const [mes, setMes] = useState<MesId | null>(publicados.length === 1 ? publicados[0]!.mes : null)
  const [vista, setVista] = useState<Vista>(publicados.length === 1 ? 'que' : 'mes')
  const [cambios, setCambios] = useState<Cambios>(SIN_CAMBIOS)
  const [motivo, setMotivo] = useState('')
  const [hecho, setHecho] = useState<CorreccionHecha | null>(null)

  const elegirMes = (m: MesId) => {
    // Cambiar de mes limpia lo escrito: mezclar una lectura de mayo con un
    // motivo de junio es exactamente la corrección equivocada.
    setMes(m)
    setCambios(SIN_CAMBIOS)
    setMotivo('')
    setVista('que')
  }

  if (hecho && mes) return <Hecha mes={mes} hecha={hecho} />

  if (!mes || vista === 'mes') {
    return (
      <Hoja titulo={COPYS.correccion.corregirMes} altura="alta">
        <div className="hoja-cuerpo">
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.eligeMes}</h2>
          <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.correccion.intro}</p>
          {publicados.map((p) => (
            <button key={p.mes} type="button" onClick={() => elegirMes(p.mes)} className="admin-accion">
              <span className="tipo-cuerpo-destacado">{p.etiqueta}</span>
              <Flecha />
            </button>
          ))}
        </div>
      </Hoja>
    )
  }

  return (
    <Corrector
      key={mes}
      mes={mes}
      cuantosMeses={publicados.length}
      vista={vista}
      setVista={setVista}
      cambios={cambios}
      setCambios={setCambios}
      motivo={motivo}
      setMotivo={setMotivo}
      onHecho={setHecho}
    />
  )
}

function Corrector({
  mes,
  cuantosMeses,
  vista,
  setVista,
  cambios,
  setCambios,
  motivo,
  setMotivo,
  onHecho,
}: {
  mes: MesId
  cuantosMeses: number
  vista: Vista
  setVista: (v: Vista) => void
  cambios: Cambios
  setCambios: (c: Cambios | ((previo: Cambios) => Cambios)) => void
  motivo: string
  setMotivo: (m: string) => void
  onHecho: (h: CorreccionHecha) => void
}) {
  const etiqueta = etiquetaMes(mes)
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['correccion', mes],
    // Sin caché: es lo que hay guardado **ahora**, y la versión tiene que ser la
    // de ahora o el servidor rechaza la corrección por vieja.
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<DatosDeCorreccion> => {
      const r = await fetch(`/api/meses/${mes}/correccion`)
      if (r.status === 401) throw new Error(COPYS.error.sesionCaducada)
      if (!r.ok) throw new Error(COPYS.error.lecturasDelMes(nombreMes(mes)))
      return r.json()
    },
  })

  /**
   * Si el mes no se pudo traer, se dice **por qué** y no se le echa la culpa a
   * quien mira. Con la consulta caída se veía el título, un hueco y un botón
   * mandando «Cambia algo para poder corregir» sobre una lista vacía.
   */
  if (isError || (!isPending && !data?.resultado.valido)) {
    return (
      <Hoja titulo={COPYS.correccion.titulo(etiqueta)} altura="alta">
        <div className="hoja-cuerpo">
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.titulo(etiqueta)}</h2>
          <Fallo>{error ? mensajeDeError(error) : COPYS.error.lecturasDelMes(nombreMes(mes))}</Fallo>
          <button type="button" onClick={() => void refetch()} className="cierre-boton">
            {COPYS.error.reintentar}
          </button>
        </div>
      </Hoja>
    )
  }

  const r = data?.resultado
  if (isPending || !data || !r || !r.valido) {
    return (
      <Hoja titulo={COPYS.correccion.titulo(etiqueta)} altura="alta">
        <div className="hoja-cuerpo">
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.titulo(etiqueta)}</h2>
          <p className="tipo-cuerpo-menor text-gris">Cargando…</p>
        </div>
      </Hoja>
    )
  }

  return (
    <Pantallas
      mes={mes}
      etiqueta={etiqueta}
      cuantosMeses={cuantosMeses}
      datos={data}
      r={r}
      vista={vista}
      setVista={setVista}
      cambios={cambios}
      setCambios={setCambios}
      motivo={motivo}
      setMotivo={setMotivo}
      onHecho={onHecho}
    />
  )
}

/** Lo que de verdad cambió respecto a lo guardado, listo para mandar al servidor. */
function cambiosParaEnviar(datos: DatosDeCorreccion, c: Cambios) {
  const rec = datos.resultado.valido ? datos.resultado.rec : null
  const fijos = datos.fijos
    .filter((f) => {
      const n = c.fijos[f.concepto]
      return n && (n.monto !== f.monto || n.anual !== f.anual || n.activo !== f.activo)
    })
    .map((f) => {
      const n = c.fijos[f.concepto]!
      return { concepto: f.concepto, monto: n.monto, anual: n.anual, activo: n.activo }
    })
  const recibo: Cambios['recibo'] = {}
  if (rec) {
    if (c.recibo.aguaM3 !== undefined && c.recibo.aguaM3 !== rec.aguaM3) recibo.aguaM3 = c.recibo.aguaM3
    if (c.recibo.aguaMonto !== undefined && c.recibo.aguaMonto !== rec.aguaMonto) recibo.aguaMonto = c.recibo.aguaMonto
    if (c.recibo.luz !== undefined && c.recibo.luz !== rec.luz) recibo.luz = c.recibo.luz
    if (c.recibo.descuento !== undefined && c.recibo.descuento !== (rec.descuento ?? null)) {
      recibo.descuento = c.recibo.descuento
    }
  }
  const lecturas: Cambios['lecturas'] = {}
  for (const [d, v] of Object.entries(c.lecturas)) {
    if (v !== undefined && v !== datos.lecturas[d]) lecturas[d as DptoId] = v
  }
  const extrasCambiaron =
    c.extras !== null &&
    huellaDeExtras(c.extras.map(comoComparable)) !== huellaDeExtras(datos.extras.map(comoComparable))
  const lavadoCambio = c.lavado !== null && datos.lavado !== null && c.lavado !== datos.lavado.activo
  return {
    ...(Object.keys(lecturas).length ? { lecturas } : {}),
    ...(Object.keys(recibo).length ? { recibo } : {}),
    ...(fijos.length ? { fijos } : {}),
    ...(extrasCambiaron ? { extras: c.extras! } : {}),
    ...(lavadoCambio ? { lavado: { activa: c.lavado! } } : {}),
  }
}

function comoComparable(e: Extra) {
  return e.tipo === 'gasto'
    ? { tipo: e.tipo, concepto: e.concepto, monto: e.monto, participantes: e.participantes, reparto: e.reparto }
    : { tipo: e.tipo, concepto: e.concepto, monto: e.monto, dpto: e.dpto }
}

function Pantallas({
  mes,
  etiqueta,
  cuantosMeses,
  datos,
  r,
  vista,
  setVista,
  cambios,
  setCambios,
  motivo,
  setMotivo,
  onHecho,
}: {
  mes: MesId
  etiqueta: string
  cuantosMeses: number
  datos: DatosDeCorreccion
  r: ResultadoMes
  vista: Vista
  setVista: (v: Vista) => void
  cambios: Cambios
  setCambios: (c: Cambios | ((previo: Cambios) => Cambios)) => void
  motivo: string
  setMotivo: (m: string) => void
  onHecho: (h: CorreccionHecha) => void
}) {
  const { abrir } = useNumpad()
  const anunciar = useAnuncio()
  const router = useRouter()
  const queryClient = useQueryClient()
  const envio = cambiosParaEnviar(datos, cambios)
  const hayCambios = Object.keys(envio).length > 0
  const marcado = (p: Parte) => p in envio

  const volver = () => setVista('que')

  /* ─────────────────────────────── la vista previa ─────────────────────── */
  const previa = useQueryPrevia(mes, datos.version, envio, vista === 'revision' && hayCambios)

  const corregir = useMutation({
    mutationFn: async (): Promise<CorreccionHecha> => {
      const respuesta = await fetch(`/api/meses/${mes}/corregir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...envio, motivo, version: datos.version }),
      })
      const cuerpo = await respuesta.json()
      if (!respuesta.ok) throw new Error(cuerpo.error ?? 'No se pudo corregir')
      return cuerpo
    },
    onSuccess: (h) => {
      anunciar(COPYS.anuncios.correccionHecha(h.cuotasQueCambiaron))
      onHecho(h)
      router.refresh()
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      void queryClient.invalidateQueries({ queryKey: ['historial'] })
      void queryClient.invalidateQueries({ queryKey: ['mes'] })
    },
  })

  const titulo = COPYS.correccion.titulo(etiqueta)
  const atras = (a: () => void = volver, texto: string = COPYS.correccion.volver) => (
    <button type="button" onClick={a} className="tipo-contexto text-gris corregir-atras">
      ← {texto}
    </button>
  )

  /* ───────────────────────────── qué corregir ──────────────────────────── */
  if (vista === 'que') {
    const rec = r.rec
    const fijosActivos = datos.fijos.filter((f) => (cambios.fijos[f.concepto]?.activo ?? f.activo)).length
    const extras = cambios.extras ?? datos.extras
    const totalExtras = round2(extras.reduce((s, e) => s + (e.tipo === 'gasto' ? e.monto : -e.monto), 0))
    const tarjetas: { parte: Parte; titulo: string; resumen: string }[] = [
      {
        parte: 'lecturas',
        titulo: COPYS.correccion.parteLecturas,
        resumen: `${DPTOS.length} medidores`,
      },
      {
        parte: 'recibo',
        titulo: COPYS.correccion.parteRecibo,
        resumen: `${cambios.recibo.aguaM3 ?? rec.aguaM3} m³ · agua S/ ${fmt(cambios.recibo.aguaMonto ?? rec.aguaMonto)} · luz S/ ${fmt(cambios.recibo.luz ?? rec.luz)}`,
      },
      {
        parte: 'fijos',
        titulo: COPYS.correccion.parteFijos,
        resumen: `${fijosActivos} ${fijosActivos === 1 ? 'concepto' : 'conceptos'} este mes`,
      },
      {
        parte: 'puntuales',
        titulo: COPYS.correccion.partePuntuales,
        resumen:
          extras.length === 0
            ? COPYS.correccion.ningunPuntual
            : `${extras.length} · ${totalExtras >= 0 ? '' : '−'}S/ ${fmt(Math.abs(totalExtras))}`,
      },
      ...(datos.lavado
        ? [
            {
              parte: 'lavado' as const,
              titulo: COPYS.correccion.parteLavado,
              resumen: (cambios.lavado ?? datos.lavado.activo) ? COPYS.cierre.lavadoActivo : COPYS.cierre.lavadoInactivo,
            },
          ]
        : []),
    ]
    return (
      <Hoja titulo={titulo} altura="alta">
        <div className="hoja-cuerpo">
          {cuantosMeses > 1 && atras(() => setVista('mes'), COPYS.correccion.otroMes)}
          <h2 className="tipo-titulo-hoja cierre-titulo">{titulo}</h2>
          <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.correccion.queCorregir}</p>
          {tarjetas.map((t) => (
            <button key={t.parte} type="button" onClick={() => setVista(t.parte)} className="admin-accion">
              <span className="min-w-0 flex-1 text-left">
                <span className="tipo-cuerpo-destacado block">{t.titulo}</span>
                <span className="tipo-contexto-chico block text-gris corregir-resumen">{t.resumen}</span>
              </span>
              {marcado(t.parte) && <span className="tipo-etiqueta-pequena corregir-marca">{COPYS.correccion.cambiado}</span>}
              <Flecha />
            </button>
          ))}
          <button
            type="button"
            onClick={hayCambios ? () => setVista('revision') : undefined}
            aria-disabled={!hayCambios}
            className={hayCambios ? 'cierre-boton' : 'cierre-boton cierre-boton-bloqueado'}
          >
            {hayCambios ? COPYS.correccion.revisar : COPYS.correccion.sinCambios}
          </button>
        </div>
      </Hoja>
    )
  }

  /* ─────────────────────────────── lecturas ────────────────────────────── */
  if (vista === 'lecturas') {
    return (
      <Hoja titulo={titulo} altura="alta">
        <div className="hoja-cuerpo">
          {atras()}
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.parteLecturas}</h2>
          <p className="tipo-etiqueta-seccion text-gris revision-etiqueta">{COPYS.correccion.lecturas}</p>
          {DPTOS.map((d) => {
            const original = datos.lecturas[d.id]
            const actual = cambios.lecturas[d.id] ?? original
            const cambiada = cambios.lecturas[d.id] !== undefined && cambios.lecturas[d.id] !== original
            return (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  abrir({
                    etiqueta: `Lectura del ${d.id} · anterior ${fmt3(r.cuotas[d.id].lecturaAnterior)}`,
                    valorInicial: actual ?? null,
                    decimales: true,
                    maxDecimales: 3,
                    sufijo: null,
                    /**
                     * Solo cuenta como cambio si de verdad cambia. Guardar el valor
                     * tal cual venía dejaba «Revisar» activo sobre una corrección
                     * vacía, y el servidor la rechazaba con un 400 que quien
                     * administra leía como que la app se rompió.
                     */
                    onOk: (v) =>
                      setCambios((previo) => {
                        const { [d.id]: _fuera, ...resto } = previo.lecturas
                        return { ...previo, lecturas: v === original ? resto : { ...resto, [d.id]: v } }
                      }),
                  })
                }
                className="lectura-fila"
              >
                <span className="min-w-0 flex-1 text-left">
                  <span className="tipo-cuerpo-lista block">
                    {d.id} <span className="text-gris">{d.nombre}</span>
                  </span>
                  <span className="tipo-contexto-chico block text-gris lectura-anterior">
                    cuota actual S/ {fmt(r.cuotas[d.id].total)}
                  </span>
                </span>
                <span className={`tipo-lectura ${cambiada ? 'text-terra' : ''}`}>{actual === undefined ? '—' : fmt3(actual)}</span>
              </button>
            )
          })}
          <button type="button" onClick={volver} className="cierre-boton">
            {COPYS.correccion.listo}
          </button>
        </div>
      </Hoja>
    )
  }

  /* ──────────────────────────────── recibo ─────────────────────────────── */
  if (vista === 'recibo') {
    const rec = r.rec
    const m3 = cambios.recibo.aguaM3 ?? rec.aguaM3
    const monto = cambios.recibo.aguaMonto ?? rec.aguaMonto
    const luz = cambios.recibo.luz ?? rec.luz
    const descuento = cambios.recibo.descuento !== undefined ? cambios.recibo.descuento : (rec.descuento ?? null)
    const poner = (campo: keyof Cambios['recibo'], v: number | null) =>
      setCambios((previo) => ({ ...previo, recibo: { ...previo.recibo, [campo]: v } }))
    return (
      <Hoja titulo={titulo} altura="alta">
        <div className="hoja-cuerpo">
          {atras()}
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.parteRecibo}</h2>
          <CampoNumerico
            etiqueta={COPYS.cierre.campoM3}
            tono="agua"
            valor={String(m3)}
            sufijo="m³"
            onTocar={() =>
              abrir({
                etiqueta: COPYS.cierre.campoM3Largo,
                valorInicial: m3,
                decimales: false,
                sufijo: 'm³',
                onOk: (v) => poner('aguaM3', v),
              })
            }
          />
          <CampoNumerico
            etiqueta={COPYS.cierre.campoMonto}
            tono="agua"
            valor={fmt(monto)}
            prefijo="S/"
            onTocar={() =>
              abrir({
                etiqueta: COPYS.cierre.campoMontoLargo,
                valorInicial: monto,
                decimales: true,
                maxDecimales: 2,
                sufijo: 'S/',
                onOk: (v) => poner('aguaMonto', v),
              })
            }
          />
          <CampoNumerico
            etiqueta={COPYS.cierre.campoDescuento}
            tono="agua"
            valor={descuento ? fmt(descuento) : null}
            prefijo="S/"
            onTocar={() =>
              abrir({
                etiqueta: COPYS.cierre.campoDescuentoLargo,
                valorInicial: descuento ?? null,
                decimales: true,
                maxDecimales: 2,
                sufijo: 'S/',
                onOk: (v) => poner('descuento', v > 0 ? v : null),
              })
            }
          />
          <CampoNumerico
            etiqueta={COPYS.cierre.campoLuz}
            valor={fmt(luz)}
            prefijo="S/"
            onTocar={() =>
              abrir({
                etiqueta: COPYS.cierre.campoLuz,
                valorInicial: luz,
                decimales: true,
                maxDecimales: 2,
                sufijo: 'S/',
                onOk: (v) => poner('luz', v),
              })
            }
          />
          <button type="button" onClick={volver} className="cierre-boton">
            {COPYS.correccion.listo}
          </button>
        </div>
      </Hoja>
    )
  }

  /* ───────────────────────────── gastos fijos ──────────────────────────── */
  if (vista === 'fijos') {
    const poner = (concepto: string, parche: Partial<Cambios['fijos'][string]>) =>
      setCambios((previo) => {
        const original = datos.fijos.find((f) => f.concepto === concepto)!
        const actual = previo.fijos[concepto] ?? {
          monto: original.monto, anual: original.anual, activo: original.activo,
        }
        return { ...previo, fijos: { ...previo.fijos, [concepto]: { ...actual, ...parche } } }
      })
    return (
      <Hoja titulo={titulo} altura="alta">
        <div className="hoja-cuerpo">
          {atras()}
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.parteFijos}</h2>
          <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.correccion.fijosAviso(nombreMes(mes))}</p>
          {datos.fijos.map((f) => {
            const n = cambios.fijos[f.concepto] ?? { monto: f.monto, anual: f.anual, activo: f.activo }
            return n.activo ? (
              <FilaFijo
                key={f.concepto}
                concepto={f.concepto}
                monto={n.monto}
                anual={n.anual}
                porConfirmar={n.monto === null}
                onMonto={(v) => poner(f.concepto, { monto: v })}
                onAnual={(anual) => poner(f.concepto, { anual })}
                onDesactivar={() => poner(f.concepto, { activo: false })}
              />
            ) : (
              <div key={f.concepto} className="admin-fila admin-fila-inactiva">
                <span className="tipo-cuerpo-medio min-w-0 flex-1 truncate">{f.concepto}</span>
                <button
                  type="button"
                  onClick={() => poner(f.concepto, { activo: true })}
                  className="fijo-nuevo-boton fijo-fila-toggle"
                >
                  {COPYS.correccion.cobrarEsteMes}
                </button>
              </div>
            )
          })}
          <p className="tipo-contexto text-gris admin-nota">{COPYS.correccion.fijosNuevo}</p>
          <button type="button" onClick={volver} className="cierre-boton">
            {COPYS.correccion.listo}
          </button>
        </div>
      </Hoja>
    )
  }

  /* ───────────────────────── gastos puntuales y créditos ────────────────── */
  if (vista === 'puntuales') {
    return (
      <Hoja titulo={titulo} altura="alta">
        <div className="hoja-cuerpo">
          {atras()}
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.partePuntuales}</h2>
          <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.correccion.puntualesIntro}</p>
          <EditorExtras
            extras={cambios.extras ?? datos.extras}
            onCambiar={(lista) => setCambios((previo) => ({ ...previo, extras: lista }))}
          />
          <button type="button" onClick={volver} className="cierre-boton">
            {COPYS.correccion.listo}
          </button>
        </div>
      </Hoja>
    )
  }

  /* ─────────────────────────────────── lavado ───────────────────────────── */
  if (vista === 'lavado' && datos.lavado) {
    const activo = cambios.lavado ?? datos.lavado.activo
    return (
      <Hoja titulo={titulo} altura="alta">
        <div className="hoja-cuerpo">
          {atras()}
          <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.parteLavado}</h2>
          <label className="casilla-fila">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setCambios((previo) => ({ ...previo, lavado: e.target.checked }))}
              className="casilla"
            />
            <span className="min-w-0 flex-1">
              <span className="tipo-cuerpo-lista block">
                {datos.lavado.dpto} · {datos.lavado.concepto}
              </span>
              <span className="tipo-contexto-chico block text-gris puntual-quien">
                {activo ? COPYS.cierre.lavadoActivo : COPYS.cierre.lavadoInactivo}
              </span>
            </span>
            <span className="tipo-monto-lista">{fmt(datos.lavado.m3)} m³</span>
          </label>
          <button type="button" onClick={volver} className="cierre-boton">
            {COPYS.correccion.listo}
          </button>
        </div>
      </Hoja>
    )
  }

  /* ─────────────────────────────── la revisión ─────────────────────────── */
  const bloqueo = !hayCambios
    ? COPYS.correccion.sinCambios
    : motivo.trim().length === 0
      ? COPYS.correccion.sinMotivo
      : previa.isError || previa.isPending
        ? COPYS.correccion.sinVistaPrevia
        : null
  const p = previa.data
  const aQuienPago = p?.cuotas.some((c) => c.pagado !== null && c.falta > 0)

  return (
    <Hoja titulo={titulo} altura="alta">
      <div className="hoja-cuerpo">
        {atras()}
        <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.correccion.revisionTitulo}</h2>
        <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.correccion.revisionIntro}</p>

        {previa.isPending && <p className="tipo-cuerpo-menor text-gris">Calculando…</p>}
        {previa.isError && <Fallo>{mensajeDeError(previa.error)}</Fallo>}

        {p && (
          <>
            <p className="tipo-etiqueta-seccion text-gris revision-etiqueta">{COPYS.correccion.loQueCambia}</p>
            {p.cambios.map((c, i) => (
              <div key={i} className="revision-fila">
                <span className="tipo-cuerpo-chico min-w-0 flex-1">{c.que}</span>
                <span className="tipo-contexto-chico text-gris corregir-de-a">
                  {c.de} → {c.a}
                </span>
              </div>
            ))}

            <p className="tipo-etiqueta-seccion text-gris revision-etiqueta">{COPYS.correccion.cuotas}</p>
            {p.cuotas.map((c) => {
              const dif = round2(c.despues - c.antes)
              return (
                <div key={c.dpto} className="corregir-cuota">
                  <div className="revision-fila corregir-cuota-fila">
                    <span className="tipo-numero-dpto w-columna-dpto">{c.dpto}</span>
                    <span className="tipo-cuerpo-chico min-w-0 flex-1 text-gris">
                      {fmt(c.antes)} → <span className="text-tinta">{fmt(c.despues)}</span>
                    </span>
                    <span className={`tipo-monto-lista-chico revision-dif ${dif > 0 ? 'text-ambar' : dif < 0 ? 'text-verde-oscuro' : 'text-gris'}`}>
                      {dif === 0 ? '—' : `${dif > 0 ? '+' : '−'}${fmt(Math.abs(dif))}`}
                    </span>
                  </div>
                  {c.pagado !== null && c.falta > 0 && (
                    <p className="tipo-contexto-chico text-ambar corregir-falta">
                      {COPYS.correccion.yaPagoYFalta(c.pagado, c.falta)}
                    </p>
                  )}
                </div>
              )
            })}
            <p className="tipo-contexto text-gris admin-nota">
              {COPYS.correccion.totalMes(fmt(p.totalMes))}
              {aQuienPago ? ` ${COPYS.correccion.quienPagoDebeDiferencia}` : ''}
            </p>
          </>
        )}

        <div className="nota-campo correccion-motivo">
          <label htmlFor="motivo-correccion" className="tipo-etiqueta-pequena text-gris nota-etiqueta">
            {COPYS.correccion.motivo}
          </label>
          {/* El motivo queda en el registro y lo leen los siete: teclado normal. */}
          <textarea
            id="motivo-correccion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={500}
            className="nota-texto tipo-cuerpo-chico"
            autoCapitalize="sentences"
            spellCheck
          />
          <p className="tipo-contexto text-gris correccion-ayuda">{COPYS.correccion.motivoAyuda}</p>
        </div>

        {corregir.isError && <Fallo>{mensajeDeError(corregir.error)}</Fallo>}

        <button
          type="button"
          onClick={bloqueo ? undefined : () => corregir.mutate()}
          aria-disabled={Boolean(bloqueo) || corregir.isPending}
          className={bloqueo ? 'cierre-boton cierre-boton-bloqueado' : 'cierre-boton'}
        >
          {corregir.isPending ? 'Guardando…' : (bloqueo ?? COPYS.correccion.guardar)}
        </button>
      </div>
    </Hoja>
  )
}

/**
 * La vista previa: el servidor corre la corrección entera y la deshace. Se pide
 * de nuevo cuando cambia lo que se manda, y nunca se guarda en caché.
 */
function useQueryPrevia(
  mes: MesId,
  version: number,
  envio: Record<string, unknown>,
  activa: boolean,
) {
  return useQuery({
    queryKey: ['correccion-previa', mes, version, envio],
    enabled: activa,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<CorreccionHecha> => {
      const r = await fetch(`/api/meses/${mes}/corregir/previa`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...envio, version }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo calcular')
      return cuerpo
    },
  })
}

function Hecha({ mes, hecha }: { mes: MesId; hecha: CorreccionHecha }) {
  const { cerrar } = useHoja()
  const debenDiferencia = hecha.cuotas.some((c) => c.pagado !== null && c.falta > 0)
  return (
    <Hoja titulo={COPYS.correccion.hecho} altura="alta">
      <div className="cierre-cuerpo publicado">
        <h2 className="tipo-titulo-hoja publicado-titulo">{COPYS.correccion.hecho}</h2>
        <p className="tipo-cuerpo-chico text-gris publicado-texto">
          {hecha.cuotasQueCambiaron === 0
            ? 'Ninguna cuota cambió de monto, pero el cambio queda registrado y avisado.'
            : `Cambiaron ${hecha.cuotasQueCambiaron} ${hecha.cuotasQueCambiaron === 1 ? 'cuota' : 'cuotas'}. Los siete ya tienen el aviso.`}
          {debenDiferencia ? ` ${COPYS.correccion.quienPagoDebeDiferencia}` : ''}
        </p>
        <AvisarWhatsapp mensaje={COPYS.avisar.mensajeCorreccion(etiquetaMes(mes), urlApp())} />
        <button type="button" onClick={cerrar} className="cierre-boton">
          {COPYS.cierre.volverAlPanel}
        </button>
      </div>
    </Hoja>
  )
}

function Flecha() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-apagado" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
