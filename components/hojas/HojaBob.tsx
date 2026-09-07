'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { COPYS } from '@/lib/copys'
import type { DptoId, MesId } from '@/lib/calculo/tipos'
import { Avatar } from '@/components/Avatar'
import { Fallo } from '@/components/ui/Fallo'
import { Hoja } from './Hoja'
import { useHoja, type ClaveHoja } from './Hojas'
import { mensajeDeError } from '@/lib/errores-ui'

/**
 * `bob` · la hoja de conversación. `05-bob-agente.md` §5.
 *
 * **Al abrir Bob, la conversación está ahí mismo.** Sin pantalla intermedia y
 * sin un segundo paso: se corrigió durante el diseño porque interrumpía el
 * flujo, y aquí se respeta.
 *
 * Lo que `05` §6 prohíbe y aquí **no** está, a propósito:
 *
 *  - Texto que aparece letra por letra fingiendo que piensa. Mientras se espera
 *    hay una línea de estado quieta, no una animación de puntos en bucle.
 *  - Chispas, gradientes morados, iconografía de «IA». El avatar es la forma
 *    ámbar de `02` §5 y no hay nada más.
 *
 *    El avatar **sí** late: respira y parpadea en bucle, porque es un blobatar
 *    y esa es su cara. No es una excepción a la regla de arriba: lo que se
 *    prohíbe es fingir que se piensa —un indicador que dice algo falso sobre lo
 *    que está pasando—, y un gesto de vida no afirma nada. `bob.spec.ts` lo
 *    tiene acotado: cualquier bucle fuera del avatar pone el test en rojo.
 *  - Burbuja flotante en la esquina: Bob se abre desde la navegación.
 *  - Disculpas y meta-comentarios sobre lo que Bob es o deja de ser.
 *
 * Las respuestas **se piden al servidor**. Ni el catálogo ni las herramientas
 * llegan al navegador: aquí no se calcula nada, se enseña lo que vino.
 */

interface Turno {
  de: 'yo' | 'bob'
  texto: string
  lleva?: { hoja: ClaveHoja; etiqueta: string } | null
}

export function HojaBob({ mes, dpto }: { mes: MesId; dpto: DptoId | null }) {
  const { abrir } = useHoja()
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [borrador, setBorrador] = useState('')
  const conversacion = useRef<HTMLDivElement>(null)

  const preguntar = useMutation({
    mutationFn: async (texto: string): Promise<{ texto: string; lleva: Turno['lleva'] }> => {
      const r = await fetch('/api/bob', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto, mes, dpto }),
      })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? COPYS.error.noSePudo)
      return cuerpo
    },
    onSuccess: (r) => setTurnos((t) => [...t, { de: 'bob', texto: r.texto, lleva: r.lleva }]),
  })

  const enviar = (texto: string) => {
    const limpio = texto.trim()
    if (!limpio || preguntar.isPending) return
    setBorrador('')
    setTurnos((t) => [...t, { de: 'yo', texto: limpio }])
    preguntar.mutate(limpio)
  }

  // La conversación baja sola al último turno. Es un salto, no un
  // desplazamiento animado: `02` §6 no tiene movimiento para esto y una
  // animación aquí sería decoración.
  useEffect(() => {
    const c = conversacion.current
    if (c) c.scrollTop = c.scrollHeight
  }, [turnos, preguntar.isPending])

  return (
    <Hoja titulo={`${COPYS.bob.nombre}, ${COPYS.bob.subtitulo}`} altura="completa" columna>
      <header className="bob-cabecera">
        <span className="bob-cabecera-avatar">
          <Avatar tamano="cabecera" sonrie />
        </span>
        <span className="bob-cabecera-texto">
          <span className="tipo-titulo-bob">{COPYS.bob.nombre}</span>
          <span className="tipo-contexto-chico text-gris bob-cabecera-subtitulo">{COPYS.bob.subtitulo}</span>
        </span>
      </header>

      <div
        ref={conversacion}
        className="bob-conversacion scroll-limpio"
        role="log"
        aria-live="polite"
        aria-label="Conversación con Bob"
      >
        {turnos.length === 0 && (
          <p className="tipo-cuerpo-menor text-gris bob-invitacion">
            Pregúntame lo que quieras sobre los números del edificio.
          </p>
        )}
        {turnos.map((t, i) => (
          <Burbuja key={i} turno={t} alAbrir={abrir} />
        ))}
        {preguntar.isPending && (
          <p className="tipo-cuerpo-menor text-gris bob-esperando">Mirando los números…</p>
        )}
        {preguntar.isError && <Fallo>{mensajeDeError(preguntar.error)}</Fallo>}
      </div>

      <div className="bob-chips scroll-limpio" data-scroll-x>
        {COPYS.bob.sugeridas.map((q) => (
          <button key={q} type="button" className="bob-chip tipo-chip" onClick={() => enviar(q)}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="bob-pie"
        onSubmit={(ev) => {
          ev.preventDefault()
          enviar(borrador)
        }}
      >
        <input
          className="bob-campo tipo-campo"
          value={borrador}
          onChange={(ev) => setBorrador(ev.target.value)}
          placeholder={COPYS.bob.campo}
          aria-label={COPYS.bob.campo}
          enterKeyHint="send"
        />
        <button
          type="submit"
          className={`bob-enviar ${borrador.trim() ? 'bob-enviar-listo' : ''}`}
          aria-label="Enviar la pregunta"
          aria-disabled={!borrador.trim() || preguntar.isPending}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M12 19V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </form>
    </Hoja>
  )
}

function Burbuja({ turno, alAbrir }: { turno: Turno; alAbrir: (h: ClaveHoja) => void }) {
  if (turno.de === 'yo') {
    return (
      <p className="bob-mia tipo-burbuja">
        <span className="bob-mia-texto">{turno.texto}</span>
      </p>
    )
  }
  return (
    <div className="bob-suya">
      <span className="bob-suya-avatar">
        <Avatar tamano="aviso" />
      </span>
      <div className="bob-suya-texto tipo-burbuja">
        {turno.texto}
        {/**
         * `05` §3: **con dónde verificarlo.** Cada respuesta enlaza a la
         * pantalla que la demuestra, que es el «nada de confía en mí» del
         * `README` §1 aplicado a lo que dice Bob.
         */}
        {turno.lleva && (
          <button
            type="button"
            className="bob-lleva tipo-cuerpo-enlace"
            onClick={() => alAbrir(turno.lleva!.hoja)}
          >
            {turno.lleva.etiqueta}
          </button>
        )}
      </div>
    </div>
  )
}
