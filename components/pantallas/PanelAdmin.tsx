'use client'

import Link from 'next/link'
import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { fechaCorta } from '@/lib/formato'
import type { DatosAdmin } from '@/lib/datos/admin'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { useHoja } from '@/components/hojas/Hojas'
import { FijarContexto } from '@/components/hojas/Contexto'
import { RegistrarPago } from './RegistrarPago'

/**
 * El panel de administración. `04-cierre-del-mes.md` §"otras funciones".
 *
 * Lo primero que se ve es lo que hay que hacer: los pagos por verificar. Después
 * el cierre del mes, y al final el resto de ajustes.
 */
export function PanelAdmin({ datos }: { datos: DatosAdmin }) {
  const { abrir } = useHoja()

  const avisados = datos.pagos.filter((p) => p.estado === 'aviso')
  const sinAviso = datos.pagos.filter((p) => p.estado === null)
  const confirmados = datos.pagos.filter((p) => p.estado === 'confirmado')

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

      {avisados.length > 0 && (
        <section className="admin-seccion">
          <Etiqueta className="block admin-seccion-titulo">Avisaron · falta confirmar</Etiqueta>
          {avisados.map((p) => (
            <RegistrarPago key={p.dpto} pago={p} mes={datos.mesPublicado!} />
          ))}
        </section>
      )}

      {sinAviso.length > 0 && (
        <section className="admin-seccion">
          <Etiqueta className="block admin-seccion-titulo">Sin aviso todavía</Etiqueta>
          {sinAviso.map((p) => (
            <RegistrarPago key={p.dpto} pago={p} mes={datos.mesPublicado!} />
          ))}
        </section>
      )}

      {confirmados.length > 0 && (
        <section className="admin-seccion">
          <Etiqueta className="block admin-seccion-titulo">Confirmados · {confirmados.length}</Etiqueta>
          {confirmados.map((p) => (
            <div key={p.dpto} className="admin-fila">
              <span className="tipo-numero-dpto w-columna-dpto">{p.dpto}</span>
              <span className="tipo-cuerpo-chico min-w-0 flex-1 truncate text-gris">{p.nombre}</span>
              <span className="tipo-contexto-mini text-gris">{fechaCorta(p.fecha)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="admin-seccion">
        <Etiqueta className="block admin-seccion-titulo">Cerrar el mes siguiente</Etiqueta>
        <p className="tipo-cuerpo-chico text-gris admin-texto">
          Siete pasos: lecturas, SEDAPAL, luz, gastos fijos, lo puntual, revisión y publicar. Se guarda solo
          en cada uno.
        </p>
        <button type="button" onClick={() => abrir('wizard')} className="admin-boton">
          {datos.paso > 0 ? `Seguir con ${datos.nombreACerrar}` : `Empezar ${datos.nombreACerrar}`}
        </button>
      </section>

      <section className="admin-seccion">
        <Etiqueta className="block admin-seccion-titulo">Gastos fijos del edificio</Etiqueta>
        {datos.gastosFijos.map((g) => (
          <div key={g.concepto} className="admin-fila">
            <span className="tipo-cuerpo-medio flex min-w-0 flex-1 items-center gap-etiqueta">
              <span className="truncate">{g.concepto}</span>
              {g.anual && <span className="tipo-etiqueta-anual etiqueta-anual">{COPYS.mes.anual}</span>}
            </span>
            <span className={g.monto === null ? 'tipo-cuerpo-enlace text-ambar' : 'tipo-monto-lista'}>
              {g.monto === null ? 'por confirmar' : fmt(g.monto)}
            </span>
          </div>
        ))}
        <p className="tipo-contexto text-gris admin-nota">
          Se editan desde el paso 4 del cierre. Un cambio aplica a los meses siguientes, no reescribe el pasado.
        </p>
      </section>

      <section className="admin-seccion admin-seccion-final">
        <Etiqueta className="block admin-seccion-titulo">Otras acciones</Etiqueta>
        {datos.lavado && (
          <button type="button" onClick={() => abrir('cargos')} className="admin-accion">
            {/* `04` lista esto como «Cargos adicionales y créditos». La fila abre
                la hoja de cargos y créditos activos; el lavado del 401 es hoy el
                único activo, y sus m³ van de indicador. Antes la fila se llamaba
                solo por el lavado, así que la función del panel quedaba oculta. */}
            <span className="min-w-0 flex-1">
              <span className="tipo-cuerpo-destacado block">Cargos y créditos</span>
              <span className="tipo-contexto-chico block text-gris">
                {datos.lavado.concepto} · {datos.lavado.dpto}
              </span>
            </span>
            <span className="tipo-monto-lista">{fmt(datos.lavado.m3)} m³</span>
          </button>
        )}
        {datos.publicados.length > 0 && (
          <button type="button" onClick={() => abrir('corregir')} className="admin-accion">
            <span className="tipo-cuerpo-destacado">{COPYS.correccion.corregirMes}</span>
            <span className="tipo-contexto text-gris">
              {datos.publicados.length === 1
                ? datos.etiquetaPublicado
                : `${datos.publicados.length} meses publicados`}
            </span>
          </button>
        )}
        <button type="button" onClick={() => abrir('export')} className="admin-accion">
          <span className="tipo-cuerpo-destacado">Exportar el año en Excel</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-apagado" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <form action="/api/admin/pin" method="post" className="admin-salir-form">
          <button type="button" onClick={() => salir()} className="tipo-cuerpo-enlace text-gris admin-salir">
            Salir de administración
          </button>
        </form>
      </section>
    </div>
  )
}

async function salir() {
  await fetch('/api/admin/pin', { method: 'DELETE' })
  window.location.href = '/'
}
