import Link from 'next/link'
import { COPYS } from '@/lib/copys'

/**
 * El acceso a Administración.
 *
 * Visible para todos: quien no tenga el PIN simplemente no entra, y no hay
 * mensaje de "no tienes permiso" (`README` §7). No hay roles ni traspaso de
 * turno: es innecesario para siete personas.
 */
export function EnlaceAdmin() {
  return (
    <div className="animar-entrada admin-enlace-contenedor">
      <Link href="/admin" className="admin-enlace">
        <span className="tipo-cuerpo-destacado flex items-center gap-etiqueta-larga text-gris">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {COPYS.miDpto.administrar}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-apagado" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  )
}
