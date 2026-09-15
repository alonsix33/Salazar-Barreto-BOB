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
    /*
     * Con letra grande de accesibilidad, un monto de "protagonista"/"secundaria"
     * (42-46px de base, más de 75px a 1.8x) no cabía en el ancho del marco: la
     * cifra se recortaba contra el `overflow:hidden` de `.marco-app` y el
     * último dígito desaparecía sin ningún indicio —en "Costó mantener el
     * edificio" y en "La cuenta" del historial—. `flex-wrap` deja que el
     * símbolo caiga a su propia línea si hace falta, y `overflow-wrap:anywhere`
     * en la cifra permite partir el número mismo antes que perderlo: se ve
     * raro partido en dos líneas, pero se sigue pudiendo leer entero.
     */
    <span className={`flex flex-wrap items-baseline gap-cifra min-w-0 ${className}`}>
      {simbolo && <span className={`${claseSimbolo} ${atenuado}`}>S/</span>}
      <span className={`${TIPO[tamano]} min-w-0 break-normal [overflow-wrap:anywhere]`}>{texto}</span>
      {sufijo && <span className={`${claseSimbolo} ${atenuado}`}>{sufijo}</span>}
    </span>
  )
}
