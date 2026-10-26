'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { fechaCorta } from '@/lib/formato'
import type { DatosAdmin } from '@/lib/datos/admin'
import { Boton } from '@/components/ui/Boton'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TarjetaNoche } from '@/components/ui/TarjetaNoche'
import { useHoja } from '@/components/hojas/Hojas'
import { FijarContexto } from '@/components/hojas/Contexto'
import { RegistrarPago } from './RegistrarPago'

/**
 * El panel de administración. `04-cierre-del-mes.md` §"otras funciones".
 *
 * Tres bloques, en el orden en que se usan:
 *
 *  1. **Lo que toca hacer ahora**: el cierre del mes, con un solo botón grande.
 *  2. **Los pagos**: solo lo que pide una acción —quién avisó, quién falta, a
 *     quién le queda una parte—. Lo ya confirmado se recoge: ocupaba media
 *     pantalla para decir que no hay nada que hacer.
 *  3. **Todo lo demás**, en una rejilla de cuatro accesos con su subtítulo.
 *
 * Antes era una columna de dos mil píxeles donde el cierre, la lista de gastos
 * fijos —que solo se leía, no se tocaba— y seis botones sueltos valían lo mismo,
 * y nada decía por dónde empezar.
 */
export function PanelAdmin({ datos }: { datos: DatosAdmin }) {
  const { abrir } = useHoja()

  const avisados = datos.pagos.filter((p) => p.estado === 'aviso')
  const sinAviso = datos.pagos.filter((p) => p.estado === null)
  const confirmados = datos.pagos.filter((p) => p.estado === 'confirmado')
  const conParte = confirmados.filter((p) => p.falta > 0)
  const hayPagosQueAtender = avisados.length + sinAviso.length + conParte.length > 0

  return (
    <div className="pantalla scroll-limpio admin-pantalla">
      {/* El mes que toca cerrar lo decide el servidor; la hoja lo lee de aquí.
          La de corregir ya no usa esto: trae la lista de meses publicados y deja
          elegir, porque con el contexto solo se podía corregir el último. */}
      <FijarContexto mes={datos.mesACerrar} dpto={null} />
      <div className="admin-barra">
        <Link href="/" className="circulo-atras" aria-label="Volver a Inicio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="admin-cabecera">
        <h1 className="tipo-titulo-pantalla">{COPYS.admin.titulo}</h1>
        <p className="tipo-cuerpo-chico text-gris admin-subtitulo">{datos.etiquetaPublicado}</p>
      </div>

      {/* 1 · Lo que toca ahora */}
      <div className="admin-seccion">
        <TarjetaNoche>
          <Etiqueta tono="sobre-noche" className="block">
            {COPYS.admin.cerrarSiguiente}
          </Etiqueta>
          <p className="tipo-titulo-hoja admin-cierre-mes">{datos.etiquetaACerrar}</p>
          <p className="tipo-cuerpo-menor text-sobre-noche-contexto admin-cierre-texto">
            {datos.paso > 0 ? COPYS.admin.cierrePaso(datos.paso) : COPYS.admin.cierrePasos}
          </p>
          <Boton tono="terra" onClick={() => abrir('wizard')}>
            {datos.paso > 0 ? `Seguir con ${datos.nombreACerrar}` : `Empezar ${datos.nombreACerrar}`}
          </Boton>
        </TarjetaNoche>
      </div>

      {/* 2 · Los pagos */}
      {datos.mesPublicado && (
        <section className="admin-seccion">
          <Etiqueta className="block admin-seccion-titulo">
            {COPYS.admin.pagosDe(datos.etiquetaPublicado)}
          </Etiqueta>
          {!hayPagosQueAtender && (
            <p className="tipo-cuerpo-chico text-gris admin-texto">{COPYS.admin.pagosAlDia}</p>
          )}
          {avisados.length > 0 && (
            <>
              <p className="tipo-cuerpo-destacado admin-subgrupo">{COPYS.admin.avisaronConfirmar}</p>
              {avisados.map((p) => (
                <RegistrarPago key={p.dpto} pago={p} mes={datos.mesPublicado!} />
              ))}
            </>
          )}
          {sinAviso.length > 0 && (
            <>
              <p className="tipo-cuerpo-destacado admin-subgrupo">{COPYS.admin.sinAvisoTodavia}</p>
              {sinAviso.map((p) => (
                <RegistrarPago key={p.dpto} pago={p} mes={datos.mesPublicado!} />
              ))}
            </>
          )}
          {conParte.length > 0 && (
            <>
              <p className="tipo-cuerpo-destacado admin-subgrupo">{COPYS.admin.faltaUnaParte}</p>
              {conParte.map((p) => (
                <div key={p.dpto} className="admin-fila">
                  <span className="tipo-numero-dpto w-columna-dpto">{p.dpto}</span>
                  <span className="min-w-0 flex-1">
                    <span className="tipo-cuerpo-chico block truncate">{p.nombre}</span>
                    <span className="tipo-contexto-chico block text-ambar admin-pago-detalle">
                      {COPYS.pagos.faltaAun(p.falta)}
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}
          {confirmados.length > 0 && (
            <details className="admin-recogido">
              <summary className="tipo-cuerpo-chico text-gris admin-recogido-titulo">
                {COPYS.admin.confirmados(confirmados.length)}
              </summary>
              {confirmados.map((p) => (
                <div key={p.dpto} className="admin-fila">
                  <span className="tipo-numero-dpto w-columna-dpto">{p.dpto}</span>
                  <span className="tipo-cuerpo-chico min-w-0 flex-1 truncate text-gris">{p.nombre}</span>
                  <span className="tipo-contexto-mini text-gris">{fechaCorta(p.fecha)}</span>
                </div>
              ))}
            </details>
          )}
          {datos.publicados.length > 1 && (
            <button type="button" onClick={() => abrir('confirmar-pagos')} className="admin-enlace-pagos tipo-cuerpo-enlace text-gris">
              {COPYS.pagos.confirmarPasados}
            </button>
          )}
        </section>
      )}

      {/* 3 · Todo lo demás */}
      <section className="admin-seccion">
        <Etiqueta className="block admin-seccion-titulo">{COPYS.admin.masAcciones}</Etiqueta>
        <div className="admin-rejilla">
          {datos.publicados.length > 0 && (
            <Acceso
              titulo={COPYS.correccion.corregirMes}
              nota={COPYS.admin.notaCorregir}
              onClick={() => abrir('corregir')}
              icono={<path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />}
            />
          )}
          <Acceso
            titulo={COPYS.admin.accesoFijos}
            nota={`${datos.gastosFijos.filter((g) => g.activo).length} ${COPYS.admin.conceptos} · ${fmt(
              datos.gastosFijos.filter((g) => g.activo).reduce((s, g) => s + (g.monto ?? 0), 0),
            )}`}
            onClick={() => abrir('gastos-fijos')}
            icono={<path d="M5 7h14M5 12h14M5 17h9" />}
          />
          {datos.lavado && (
            <Acceso
              /* `04` lo lista como «Cargos adicionales y créditos». La hoja abre
                 los cargos y créditos activos; el lavado del 401 es hoy el único,
                 y sus m³ van de indicador. */
              titulo="Cargos y créditos"
              nota={`${datos.lavado.concepto} · ${datos.lavado.dpto} · ${fmt(datos.lavado.m3)} m³`}
              onClick={() => abrir('cargos')}
              icono={<path d="M12 3v18M7 8c0-2 2-3 5-3s5 1 5 3-2 3-5 3-5 1-5 3 2 3 5 3 5-1 5-3" />}
            />
          )}
          <Acceso
            titulo="Exportar el año en Excel"
            nota={COPYS.admin.notaExportar}
            onClick={() => abrir('export')}
            icono={<path d="M12 4v11M7 11l5 5 5-5M5 20h14" />}
          />
        </div>
      </section>

      <section className="admin-seccion admin-seccion-final">
        {/* El estado de Bob, a la vista.

            No es decoración: el modo de Bob no se nota desde fuera —el catálogo
            responde a todo y nunca falla—, así que un Bob apagado por una
            variable de entorno se ve igual que uno encendido, solo que peor.
            Pasó en producción. Aquí se lee de un vistazo, sin entrar a Vercel. */}
        <p className="tipo-contexto-chico text-gris admin-estado-bob">
          Bob responde{' '}
          {datos.bob.modo === 'deepseek' ? 'con el modelo' : 'solo con el catálogo'}.{' '}
          {datos.bob.porQue}
        </p>
        <form action="/api/admin/pin" method="post" className="admin-salir-form">
          <button type="button" onClick={() => salir()} className="tipo-cuerpo-enlace text-gris admin-salir">
            Salir de administración
          </button>
        </form>
      </section>
    </div>
  )
}

/** Un acceso de la rejilla: icono, título y una línea que dice qué hay dentro. */
function Acceso({
  titulo,
  nota,
  onClick,
  icono,
}: {
  titulo: string
  nota: string
  onClick: () => void
  icono: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className="admin-acceso">
      <span className="admin-acceso-icono" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icono}
        </svg>
      </span>
      <span className="tipo-cuerpo-destacado block admin-acceso-titulo">{titulo}</span>
      <span className="tipo-contexto-chico block text-gris admin-acceso-nota">{nota}</span>
    </button>
  )
}

async function salir() {
  await fetch('/api/admin/pin', { method: 'DELETE' })
  window.location.href = '/'
}
