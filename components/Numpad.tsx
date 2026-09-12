'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import { fmt3 } from '@/lib/calculo/redondeo'

/**
 * El teclado numérico propio. `02-sistema-de-diseno.md` §4.6.
 *
 * **No se usa el teclado del sistema en ningún campo numérico.** No es una
 * preferencia estética: el teclado nativo tapa justo el contexto que el usuario
 * necesita para decidir —la lectura del mes pasado, el promedio, lo que dice
 * Bob— y en Android cambia demasiado de un teléfono a otro.
 *
 * Se superpone a cualquier hoja, incluido el cierre del mes.
 */

export interface PeticionNumpad {
  /** Lo que se lee arriba: *"Lectura del 401 · anterior 420.638"*. */
  etiqueta: string
  valorInicial?: number | null
  /** `false` en los m³ del recibo, que vienen en entero. */
  decimales?: boolean
  sufijo?: 'S/' | 'm³' | null
  /** Cuántos decimales admite. Tres para lecturas, dos para montos. */
  maxDecimales?: 2 | 3
  onOk: (valor: number) => void
}

interface Contexto {
  abrir: (peticion: PeticionNumpad) => void
  abierto: boolean
}

const ContextoNumpad = createContext<Contexto | null>(null)

export function useNumpad(): Contexto {
  const ctx = useContext(ContextoNumpad)
  if (!ctx) throw new Error('useNumpad fuera de <ProveedorNumpad>')
  return ctx
}

export function ProveedorNumpad({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<PeticionNumpad | null>(null)
  const [valor, setValor] = useState('')

  const abrir = useCallback((p: PeticionNumpad) => {
    setPeticion(p)
    setValor(p.valorInicial != null ? String(p.valorInicial) : '')
  }, [])

  const valorCtx = useMemo(() => ({ abrir, abierto: peticion !== null }), [abrir, peticion])

  return (
    <ContextoNumpad.Provider value={valorCtx}>
      {children}
      {peticion && (
        <Teclado
          peticion={peticion}
          valor={valor}
          setValor={setValor}
          cerrar={() => setPeticion(null)}
        />
      )}
    </ContextoNumpad.Provider>
  )
}

function Teclado({
  peticion,
  valor,
  setValor,
  cerrar,
}: {
  peticion: PeticionNumpad
  valor: string
  /**
   * El `setValor` de `useState`, entero: **hace falta la forma funcional**.
   * Tipado como `(v: string) => void` a secas, `pulsar` no podía leer el valor
   * más reciente y se perdían dígitos al teclear rápido.
   */
  setValor: Dispatch<SetStateAction<string>>
  cerrar: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)

  /**
   * El teclado se lleva el foco, lo retiene, y se cierra con `Escape`.
   *
   * Sin esto **la app no se podía administrar sin ratón**, y no es una figura
   * retórica: el numpad es la única entrada de cifras que existe —las siete
   * lecturas, el recibo de agua, la luz, los gastos fijos, los puntuales, las
   * correcciones, los cargos— y con el teclado era inalcanzable. El foco se
   * quedaba en la hoja de detrás, cuya trampa de foco lo paseaba en bucle para
   * siempre, y `Escape` cerraba **la hoja** dejando el numpad huérfano en
   * pantalla, sin nada detrás y sin forma de cerrarlo salvo recargar.
   *
   * Se comprobó tabulando treinta veces con el numpad abierto: el foco no entró
   * ni una vez.
   */
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    panel.current?.focus()

    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        // Se para aquí: si sube, el proveedor de hojas cierra la hoja de detrás.
        ev.preventDefault()
        ev.stopPropagation()
        cerrar()
        return
      }
      if (ev.key !== 'Tab' || !panel.current) return
      const focos = [
        panel.current,
        ...panel.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
      ]
      const primero = focos[0]!
      const ultimo = focos[focos.length - 1]!
      if (ev.shiftKey && document.activeElement === primero) {
        ev.preventDefault()
        ultimo.focus()
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault()
        primero.focus()
      }
    }

    // En captura: llega antes que el manejador de `Escape` de las hojas, que
    // escucha en `window` y no sabe que hay un teclado encima.
    document.addEventListener('keydown', alTeclear, true)
    return () => {
      document.removeEventListener('keydown', alTeclear, true)
      antes?.focus()
    }
  }, [cerrar])

  const admiteDecimales = peticion.decimales !== false
  const maxDecimales = peticion.maxDecimales ?? 3
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', admiteDecimales ? '.' : '', '0', '←']

  /**
   * Una tecla, aplicada **sobre el valor más reciente**, no sobre el que había
   * cuando se pintó el botón.
   *
   * Esto era `setValor(valor + k)`, con `valor` del cierre, y ahí hay una
   * pérdida de dígitos de verdad: si dos pulsaciones se procesan antes de que
   * React vuelva a pintar —dedos rápidos en un teléfono, o la máquina
   * cargada—, la segunda parte del mismo `valor` viejo y la primera se pierde.
   * Con los borrados igual: doce toques seguidos podían borrar once.
   *
   * En una app de recibos eso no es un detalle de interfaz. Una lectura de
   * medidor con un dígito de menos cambia el consumo, cambia la cuota, y no
   * hay nada en pantalla que lo delate: el número que queda también parece un
   * número. Apareció en una corrida completa de las pruebas, donde salió
   * 438.038 en vez del 483.038 que se tecleó.
   *
   * La forma funcional lo cierra: cada pulsación ve lo que dejó la anterior,
   * las procese React cuando las procese.
   */
  const pulsar = (k: string) => {
    setValor((v) => {
      if (k === '←') return v.slice(0, -1)
      if (k === '.') return v.includes('.') ? v : (v || '0') + '.'
      if (admiteDecimales && v.includes('.') && (v.split('.')[1]?.length ?? 0) >= maxDecimales) return v
      // Sin esto se pueden teclear cincuenta dígitos y el número deja de ser uno.
      if (v.replace('.', '').length >= 12) return v
      return v + k
    })
  }

  const guardar = () => {
    const n = Number(valor)
    cerrar()
    if (Number.isFinite(n)) peticion.onOk(n)
  }

  // El teclado se pinta dentro de `.marco-app` con un portal (ver más abajo).
  const capa = (
    <div className="numpad-capa" role="dialog" aria-modal="true" aria-label={peticion.etiqueta}>
      <button type="button" className="numpad-velo" onClick={cerrar} aria-label="Cancelar" tabIndex={-1} />
      <div className="numpad-panel" ref={panel} tabIndex={-1}>
        <p className="tipo-etiqueta-pequena text-gris numpad-etiqueta">{peticion.etiqueta}</p>
        <p className="numpad-valor" aria-live="polite">
          {peticion.sufijo === 'S/' && <span className="tipo-simbolo text-gris">S/</span>}
          <span className={valor ? 'numpad-numero' : 'numpad-numero numpad-vacio'}>{valor || '0'}</span>
          {peticion.sufijo === 'm³' && <span className="tipo-simbolo text-gris">m³</span>}
          <span className="numpad-cursor" aria-hidden="true" />
        </p>
        <div className="numpad-rejilla">
          {teclas.map((k, i) =>
            k === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => pulsar(k)}
                className={k === '←' ? 'numpad-tecla numpad-borrar' : 'numpad-tecla'}
                aria-label={k === '←' ? 'Borrar' : k === '.' ? 'Punto decimal' : k}
              >
                {k === '←' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                    <path d="M21 5H9L3 12l6 7h12z" />
                    <path d="M17 9l-5 6" />
                    <path d="M12 9l5 6" />
                  </svg>
                ) : (
                  k
                )}
              </button>
            ),
          )}
        </div>
        <div className="numpad-acciones">
          <button type="button" onClick={cerrar} className="numpad-cancelar">
            Cancelar
          </button>
          <button
            type="button"
            onClick={valor ? guardar : undefined}
            aria-disabled={!valor}
            className={valor ? 'numpad-guardar' : 'numpad-guardar numpad-guardar-inactivo'}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )

  const marco = typeof document !== 'undefined' ? document.getElementById('marco-app') : null
  return marco ? createPortal(capa, marco) : capa
}

/** El texto de la etiqueta del numpad para una lectura de medidor. */
export function etiquetaLectura(dpto: string, anterior: number | undefined): string {
  return anterior === undefined
    ? `Lectura del ${dpto}`
    : `Lectura del ${dpto} · anterior ${fmt3(anterior)}`
}
