'use client'

/**
 * Un campo que abre el teclado numérico propio.
 *
 * **Nunca un `<input type="number">`.** `02` §4.6: el teclado del sistema tapa el
 * contexto que el usuario necesita ver —la lectura anterior, el promedio, lo que
 * dice Bob— y en Android cambia demasiado de un teléfono a otro.
 */
export function CampoNumerico({
  etiqueta,
  valor,
  onTocar,
  prefijo,
  sufijo,
  tono = 'neutro',
}: {
  etiqueta: string
  /** `null` cuando todavía no se escribió. */
  valor: string | null
  onTocar: () => void
  prefijo?: string
  sufijo?: string
  tono?: 'neutro' | 'agua'
}) {
  return (
    <button type="button" onClick={onTocar} className="campo">
      <span className={`tipo-etiqueta-pequena block campo-etiqueta ${tono === 'agua' ? 'text-agua' : 'text-gris'}`}>
        {etiqueta}
      </span>
      <span className="campo-valor">
        {prefijo && <span className="tipo-simbolo-mini text-gris">{prefijo}</span>}
        <span className={valor === null ? 'campo-cifra text-apagado' : 'campo-cifra'}>{valor ?? '—'}</span>
        {sufijo && <span className="tipo-simbolo-mini text-gris">{sufijo}</span>}
      </span>
    </button>
  )
}
