'use client'

import { Avatar } from '@/components/Avatar'

/**
 * Bob dentro del cierre. `05-bob-agente.md` §4 y `04` §4.
 *
 * **Acompaña con contexto, no valida ni decide.** Compara con meses anteriores y
 * avisa si algo se sale de lo normal, pero el que decide es el administrador:
 * ninguno de estos avisos bloquea nada.
 *
 * Tarjeta de fondo ámbar suave con el avatar a la izquierda, dos líneas como
 * mucho. En celeste cuando habla de agua.
 */
export function AvisoBob({ children, tono = 'ambar' }: { children: string; tono?: 'ambar' | 'agua' }) {
  return (
    <div className={tono === 'agua' ? 'bob-nota bob-nota-agua' : 'bob-nota'}>
      <span className="bob-nota-avatar">
        <Avatar tamano="linea" />
      </span>
      <p className="tipo-cuerpo-menor bob-nota-texto">{children}</p>
    </div>
  )
}
