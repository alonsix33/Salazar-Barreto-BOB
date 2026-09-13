/**
 * Bob haciendo cuentas, y la línea que separa una cuenta de una invención.
 *
 * La guarda estricta —«toda cifra tiene que estar tal cual en un resultado»—
 * era demasiado estricta y le quitaba a Bob lo que lo hace útil. «¿Hace cuántos
 * días que no paga el 501?» es una resta entre la fecha del último pago, que
 * sale del sistema, y hoy; con la guarda a secas esa respuesta correcta se
 * descartaba y el vecino recibía un «de eso no tengo dato» que era mentira.
 *
 * Aflojarla es el cambio arriesgado de todo esto, así que lo que más se prueba
 * aquí no es lo que ahora pasa: es **lo que sigue sin pasar**.
 */

import { describe, expect, it } from 'vitest'
import { conCuentasSimples, numerosInventados, piezasPermitidas } from '../guardas'
import type { Llamada } from '../tipos'

const llamada = (resultado: unknown): Llamada[] => [
  { herramienta: 'loQueSea', argumentos: {}, resultado, ms: 0 },
]

/** Junio de 2026: el total del mes, la cuota del 401 y lo que depositó. */
const MES = llamada({
  dpto: '401',
  totalMes: 3512.58,
  cuota: 364.05,
  pagado: 397.0,
  guardania: 1625.0,
  fechaPago: '2026-06-24',
})

describe('lo que Bob ahora sí puede decir', () => {
  const puede = (frase: string) =>
    expect(numerosInventados(frase, MES), frase).toEqual([])

  it('una resta: lo que sobró de un depósito', () => {
    // 397.00 − 364.05 = 32.95, y el 32.95 no está en ningún resultado.
    puede('Depositaste S/ 397.00 sobre una cuota de S/ 364.05, así que te quedan S/ 32.95 a favor.')
  })

  it('un porcentaje: cuánto pesa un concepto en el mes', () => {
    // 1625 / 3512.58 × 100 = 46.26 %.
    puede('La guardianía es el 46.26 % del mes.')
  })

  it('una suma', () => {
    puede('Entre la guardianía y tu cuota son S/ 1,989.05.')
  })

  it('un múltiplo', () => {
    // 1625 / 364.05 = 4.46 veces.
    puede('La guardianía sola es 4.46 veces tu cuota.')
  })

  it('los días desde una fecha del sistema hasta hoy', () => {
    const hoy = new Date()
    const dias = Math.round(
      (Date.parse(`${hoy.toISOString().slice(0, 10)}T00:00:00Z`) - Date.parse('2026-06-24T00:00:00Z')) /
        86_400_000,
    )
    puede(`El último pago del 401 fue el 2026-06-24, hace ${Math.abs(dias)} días.`)
  })

  it('los días entre dos fechas del sistema', () => {
    const dos = llamada({ a: '2026-06-24', b: '2026-07-20' })
    // Son 26 días, y el 26 no está en ningún sitio.
    expect(numerosInventados('Entre 2026-06-24 y 2026-07-20 pasaron 26 días.', dos)).toEqual([])
  })
})

describe('lo que sigue sin poder decir, que es el punto', () => {
  const noPuede = (frase: string, cifra: string) =>
    expect(numerosInventados(frase, MES), frase).toContain(cifra)

  it('un monto que no sale de ninguna cuenta', () => {
    noPuede('La guardianía cuesta S/ 1,800.00 al mes.', '1800')
  })

  it('una cifra redonda que suena creíble', () => {
    // 500 no es suma, resta, porcentaje ni múltiplo de nada de este mes.
    noPuede('El ascensor son S/ 500.00.', '500')
  })

  it('un mes del que no se habló', () => {
    noPuede('En 2026-02 fue distinto.', '2026-02')
  })

  it('un porcentaje que no corresponde', () => {
    noPuede('La guardianía es el 71 % del mes.', '71')
  })

  it('sin ninguna llamada, no se permite ninguna cifra', () => {
    expect(numerosInventados('Tu cuota es S/ 364.05.', [])).toContain('364.05')
  })
})

describe('el tope, para que una respuesta no se coma la memoria', () => {
  it('con demasiadas cifras se vuelve a la guarda estricta', () => {
    // 200 cifras darían 40 000 pares y seis derivadas por par. El tope corta.
    const muchas = llamada(Array.from({ length: 200 }, (_, i) => i + 1000))
    const base = piezasPermitidas(muchas)
    const ancho = conCuentasSimples(base)
    expect(ancho.numeros.size).toBe(base.numeros.size)
    // Y con la guarda estricta, una suma ya no pasa.
    expect(numerosInventados('Son 2001 en total.', muchas)).toContain('2001')
  })

  it('justo por debajo del tope sí deriva', () => {
    const pocas = llamada([10, 20])
    const base = piezasPermitidas(pocas)
    expect(conCuentasSimples(base).numeros.size).toBeGreaterThan(base.numeros.size)
  })
})

describe('el barrido: cuántas invenciones se cuelan', () => {
  /**
   * La pregunta incómoda de este cambio: al permitir las cuentas, el conjunto
   * de cifras aceptadas crece, y una cifra inventada podría coincidir por
   * casualidad con alguna derivada. Esto lo **mide** en vez de suponerlo.
   *
   * El criterio no es cero: es que siga siendo raro. Una invención que coincide
   * al céntimo con una resta de dos cifras del mes es, además, una cifra que
   * está muy cerca de ser verdad.
   */
  it('menos de 1 de cada 100 cifras al azar pasa el filtro', () => {
    let colados = 0
    const total = 400
    for (let i = 0; i < total; i++) {
      // Montos con dos decimales en el rango en que vive esta app.
      const inventado = Math.round((50 + ((i * 9973) % 500_000) / 100) * 100) / 100
      if (numerosInventados(`Son S/ ${inventado.toFixed(2)}.`, MES).length === 0) colados++
    }
    const proporcion = colados / total
    // Medido hoy: 3 de 20 000 con estas seis cifras de origen, 0.01 %. El tope
    // es 1 % para que un aflojamiento futuro se note, no para dar por bueno el
    // 1 %: si esto sube, es que alguien amplió lo que se deriva.
    expect(proporcion, `se colaron ${colados} de ${total}`).toBeLessThan(0.01)
  })
})
