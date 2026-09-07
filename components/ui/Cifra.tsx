import { fmt, fmt3 } from '@/lib/calculo/redondeo'

/**
 * Un monto en soles o un consumo en m³, en JetBrains Mono.
 *
 * El símbolo `S/` va aparte y atenuado, como en `02` §2. El valor se formatea
 * siempre con `fmt`, nunca a mano: así no hay dos sitios que redondeen distinto.
 */

export type TamanoCifra =
  | 'protagonista'
  | 'secundaria'
  | 'secundaria-menor'
  | 'tarjeta'
  | 'tarjeta-media'
  | 'tarjeta-chica'
  | 'bloque'
  | 'destacado'
  | 'columna'
  | 'fila'
  | 'lista'
  | 'lista-chico'

const TIPO: Record<TamanoCifra, string> = {
  protagonista: 'tipo-cifra-protagonista',
  secundaria: 'tipo-cifra-secundaria',
  'secundaria-menor': 'tipo-cifra-secundaria-menor',
  tarjeta: 'tipo-cifra-tarjeta',
  'tarjeta-media': 'tipo-cifra-tarjeta-media',
  'tarjeta-chica': 'tipo-cifra-tarjeta-chica',
  bloque: 'tipo-cifra-bloque',
  destacado: 'tipo-monto-destacado',
  columna: 'tipo-monto-columna',
  fila: 'tipo-monto-fila',
  lista: 'tipo-monto-lista',
  'lista-chico': 'tipo-monto-lista-chico',
}

const SIMBOLO: Partial<Record<TamanoCifra, string>> = {
  protagonista: 'tipo-simbolo-grande',
  secundaria: 'tipo-simbolo',
  'secundaria-menor': 'tipo-simbolo',
  tarjeta: 'tipo-simbolo-chico',
  'tarjeta-media': 'tipo-simbolo-mini',
  'tarjeta-chica': 'tipo-simbolo-mini',
}

export function Cifra({
  valor,
  tamano = 'lista',
  simbolo = false,
  sufijo,
  decimales = 2,
  sobreNoche = false,
  className = '',
}: {
  valor: number | null
  tamano?: TamanoCifra
  /** Antepone `S/` atenuado. */
  simbolo?: boolean
  /** Por ejemplo `m³`. Va detrás, atenuado. */
  sufijo?: string
  decimales?: 2 | 3
  sobreNoche?: boolean
  className?: string
}) {
  const texto = decimales === 3 ? fmt3(valor) : fmt(valor)
  const atenuado = sobreNoche ? 'text-sobre-noche-terciario' : 'text-gris'
  const claseSimbolo = SIMBOLO[tamano] ?? 'tipo-simbolo-mini'
  return (
    <span className={`flex items-baseline gap-cifra ${className}`}>
      {simbolo && <span className={`${claseSimbolo} ${atenuado}`}>S/</span>}
      <span className={TIPO[tamano]}>{texto}</span>
      {sufijo && <span className={`${claseSimbolo} ${atenuado}`}>{sufijo}</span>}
    </span>
  )
}
