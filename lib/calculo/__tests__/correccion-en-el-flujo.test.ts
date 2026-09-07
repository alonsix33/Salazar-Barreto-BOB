/**
 * La corrección de tecleo, **en el orden real del cierre**.
 *
 * El motor de §8 ya estaba probado contra el mockup en `fidelidad-mockup`. Lo
 * que no estaba probado es el momento en que se llama, y ahí estaba el defecto:
 * el paso 1 (lecturas) va antes del paso 2 (recibo), así que cuando el paso 1
 * preguntaba, `objetivoM3` valía 0 y **ninguna** candidata podía pasar la
 * condición de SEDAPAL. La propuesta no salía nunca. Verde, y muerta.
 *
 * Estos tests fijan las dos cosas: cuándo se dispara, y qué frase sale.
 */
import { describe, it, expect } from 'vitest'
import { proponerCorreccion, revisarLecturas, motivosLectura } from '../correccion'
import { COPYS } from '@/lib/copys'
import { fmt, fmt3, round2 } from '../redondeo'

/** El caso de `04-cierre-del-mes.md`: el 401 teclea 483.038 en vez de 438.038. */
const ANTERIORES = {
  '101': 100.0, '201': 200.0, '202': 300.0, '301': 400.0,
  '401': 420.638, '501': 500.0, '502': 600.0,
} as const
const BIEN = {
  '101': 106.0, '201': 208.0, '202': 312.0, '301': 409.0,
  '401': 438.038, '501': 512.0, '502': 613.48,
} as const
const PROMEDIOS = {
  '101': 6, '201': 8, '202': 12, '301': 9, '401': 17, '501': 12, '502': 13.48,
} as const
const DPTOS = ['101', '201', '202', '301', '401', '501', '502'] as const
/**
 * Los m³ que suman las siete lecturas buenas: 6+8+12+9+17.40+12+13.48 = 77.88.
 * SEDAPAL facturó 81: la diferencia, 3.12 m³, es el área común. Son las cifras
 * del ejemplo de `04` —promedio 17, otros medidores 60.48, factura 81 m³—.
 */
const OBJETIVO = 81

describe('sin recibo la regla de §8 no se puede evaluar', () => {
  it('con objetivoM3 = 0 no propone nada, ni una vez en 11 mil lecturas', () => {
    let propuso = 0
    for (let t = 420700; t < 500000; t += 7) {
      if (proponerCorreccion((t / 1000).toFixed(3), 420.638, 17.0, 0, 60.48) !== null) propuso++
    }
    expect(propuso).toBe(0)
  })

  it('revisarLecturas devuelve null sin recibo, aunque estén las siete lecturas', () => {
    const malas = { ...BIEN, '401': 483.038 }
    expect(revisarLecturas(malas, ANTERIORES, PROMEDIOS, 0, DPTOS)).toBe(null)
  })

  it('y devuelve null con el recibo pero sin las siete lecturas', () => {
    const aMedias = { '101': 106.0, '401': 483.038 }
    expect(revisarLecturas(aMedias, ANTERIORES, PROMEDIOS, OBJETIVO, DPTOS)).toBe(null)
  })
})

describe('con las siete lecturas y el recibo, que es el paso 2', () => {
  it('encuentra el dígito transpuesto y propone una sola candidata', () => {
    const p = revisarLecturas({ ...BIEN, '401': 483.038 }, ANTERIORES, PROMEDIOS, OBJETIVO, DPTOS)
    expect(p).not.toBe(null)
    expect(p!.dpto).toBe('401')
    expect(p!.valor).toBe(438.038)
    expect(p!.tecleado).toBe(483.038)
    expect(p!.consumoTecleado).toBe(62.4)
    expect(p!.veces).toBe(4)
  })

  it('se calla cuando las siete lecturas están bien', () => {
    expect(revisarLecturas(BIEN, ANTERIORES, PROMEDIOS, OBJETIVO, DPTOS)).toBe(null)
  })

  /**
   * Con dos departamentos sospechosos, se calla.
   *
   * Este caso costó encontrarlo y el que había antes no valía: era
   * `if (p !== null) expect(p.dpto).toBe('401') else expect(p).toBe(null)`, una
   * tautología que acepta cualquier cosa. Con las lecturas que le pasaba, la
   * regla no encontraba **ningún** sospechoso, así que el test pasaba por vacío:
   * cambiar `encontradas.length === 1` por `>= 1` lo dejaba igual de verde.
   *
   * Estas dos erratas sí producen dos. Y enseñan por qué la regla importa: una
   * de las dos señaladas es el **401, que está bien tecleado**. Con dos lecturas
   * malas, `otros` se descoloca para todos y la regla acusa a un inocente.
   */
  it('con dos departamentos sospechosos se calla, aunque uno sea inocente', () => {
    const dos = { ...BIEN, '202': 302.0, '502': 613.408 }
    expect(revisarLecturas(dos, ANTERIORES, PROMEDIOS, OBJETIVO, DPTOS)).toBe(null)
  })

  it('y de verdad hay dos: sin la regla, saldrían el 401 y el 502', () => {
    // El control positivo del test de arriba. Sin él, «devuelve null» no
    // distingue entre «se calló porque había dos» y «no había ninguno».
    const dos = { ...BIEN, '202': 302.0, '502': 613.408 }
    const candidatos = DPTOS.filter((id) => {
      const otros = round2(
        DPTOS.filter((o) => o !== id).reduce((s, o) => s + round2(dos[o]! - ANTERIORES[o]!), 0),
      )
      const c = proponerCorreccion(dos[id]!, ANTERIORES[id]!, PROMEDIOS[id]!, OBJETIVO, otros)
      return c !== null && c.valor !== dos[id]
    })
    expect(candidatos).toEqual(['401', '502'])
  })

  it('rechaza una lectura menor que la anterior sin proponer nada raro', () => {
    const p = revisarLecturas({ ...BIEN, '401': 400.0 }, ANTERIORES, PROMEDIOS, OBJETIVO, DPTOS)
    if (p) expect(p.valor).toBeGreaterThan(ANTERIORES['401'])
  })
})

describe('la frase, literal de 04-cierre-del-mes.md', () => {
  it('reproduce el ejemplo del documento carácter a carácter', () => {
    const p = revisarLecturas({ ...BIEN, '401': 483.038 }, ANTERIORES, PROMEDIOS, OBJETIVO, DPTOS)!
    const frase = COPYS.cierre.propuesta({
      valor: fmt3(p.valor),
      tecleado: fmt3(p.tecleado),
      anterior: fmt3(p.anterior),
      consumoTecleado: fmt(p.consumoTecleado),
      veces: p.veces,
      motivos: p.motivos,
    })
    expect(frase).toBe(
      '¿Será 438.038? Con 483.038 el consumo sería 62.40 m³, cuatro veces tu promedio, ' +
        'y el edificio pasaría de lo que facturó SEDAPAL.',
    )
  })

  it('no afirma que el edificio se pasa cuando en realidad se queda corto', () => {
    // Una lectura muy baja: el edificio queda por debajo de lo facturado.
    const motivos = motivosLectura(421.0, 420.638, 17, 86, 60.48)
    expect(motivos).toContain('bajoFactura')
    expect(motivos).not.toContain('pasaFactura')
    const frase = COPYS.cierre.propuesta({
      valor: '438.038', tecleado: '421.000', anterior: '420.638',
      consumoTecleado: '0.36', veces: 0, motivos,
    })
    expect(frase).not.toContain('pasaría de lo que facturó')
    expect(frase).toContain('le faltaría agua para llegar a lo que facturó SEDAPAL')
    // Y no dice dos veces "muy por debajo": son dos problemas distintos.
    expect(frase.match(/muy por debajo/g) ?? []).toHaveLength(1)
  })

  it('una sola razón se escribe sin la coma del «y»', () => {
    expect(
      COPYS.cierre.propuesta({
        valor: '438.038', tecleado: '483.038', anterior: '420.638',
        consumoTecleado: '62.40', veces: 4, motivos: ['muyAlto'],
      }),
    ).toBe('¿Será 438.038? Con 483.038 el consumo sería 62.40 m³, cuatro veces tu promedio.')
  })

  it('el doble se dice «más del doble», no «2 veces» ni «el doble» a secas', () => {
    expect(
      COPYS.cierre.propuesta({
        valor: '1.000', tecleado: '2.000', anterior: '0.500',
        consumoTecleado: '34.00', veces: 2, motivos: ['muyAlto'],
      }),
    ).toContain('más del doble de tu promedio')
  })

  it('fuera de la lista de palabras vuelve a la cifra', () => {
    expect(
      COPYS.cierre.propuesta({
        valor: '1.000', tecleado: '2.000', anterior: '0.500',
        consumoTecleado: '238.00', veces: 14, motivos: ['muyAlto'],
      }),
    ).toContain('14 veces tu promedio')
  })
})

/**
 * Los cuatro casos que pide el verificador de la Fase 5, con los datos **reales**
 * de julio: los mismos que teclea el test de extremo a extremo.
 */
describe('julio de verdad · los cuatro casos del verificador', () => {
  const JUNIO = {
    '101': 180.23, '201': 177.387, '202': 35.112, '301': 426.921,
    '401': 420.638, '501': 230.386, '502': 280.748,
  }
  const JULIO = {
    '101': 186.461, '201': 185.256, '202': 52.513, '301': 441.532,
    '401': 438.038, '501': 232.826, '502': 292.678,
  }
  /** Los promedios que la app calcula de los seis meses anteriores a julio. */
  const PROM = {
    '101': 5.64, '201': 9.148, '202': 4.047, '301': 16.102,
    '401': 15.327, '501': 2.428, '502': 20.952,
  }
  const M3 = 81

  it('dos dígitos transpuestos en el 401: la propone', () => {
    const p = revisarLecturas({ ...JULIO, '401': 483.038 }, JUNIO, PROM, M3, DPTOS)
    expect(p).not.toBe(null)
    expect(p!.dpto).toBe('401')
    expect(p!.valor).toBe(438.038)
    expect(p!.motivos).toEqual(['muyAlto', 'pasaFactura'])
  })

  it('con las siete bien, se calla', () => {
    expect(revisarLecturas(JULIO, JUNIO, PROM, M3, DPTOS)).toBe(null)
  })

  it('una lectura menor que la anterior no se acepta como corrección', () => {
    const p = revisarLecturas({ ...JULIO, '401': 400.0 }, JUNIO, PROM, M3, DPTOS)
    // Si propone algo, nunca puede ser un valor por debajo del medidor anterior.
    if (p) expect(p.valor).toBeGreaterThan(JUNIO['401'])
  })

  it('con dos lecturas sospechosas a la vez, se calla', () => {
    const p = revisarLecturas(
      { ...JULIO, '401': 483.038, '101': 816.461 },
      JUNIO,
      PROM,
      M3,
      DPTOS,
    )
    expect(p).toBe(null)
  })
})

/**
 * La misma escena que teclea el test de extremo a extremo, con los datos reales
 * de julio. Está aquí para que el motor y la pantalla no puedan separarse: si
 * alguien cambia las cifras del `.spec.ts` sin mirar, este test se entera.
 */
describe('julio · la escena de dos sospechosos que usa el test de pantalla', () => {
  const JUNIO = {
    '101': 180.23, '201': 177.387, '202': 35.112, '301': 426.921,
    '401': 420.638, '501': 230.386, '502': 280.748,
  }
  const JULIO = {
    '101': 186.461, '201': 185.256, '202': 52.513, '301': 441.532,
    '401': 438.038, '501': 232.826, '502': 292.678,
  }
  const PROM = {
    '101': 5.64, '201': 9.148, '202': 4.047, '301': 16.102,
    '401': 15.327, '501': 2.428, '502': 20.952,
  }
  /** El 101 con dos dígitos cambiados y el 201 con uno mal. */
  const MALAS = { ...JULIO, '101': 184.661, '201': 175.256 }

  it('se calla', () => {
    expect(revisarLecturas(MALAS, JUNIO, PROM, 81, DPTOS)).toBe(null)
  })

  it('y hay tres candidatos, dos de ellos bien tecleados', () => {
    const candidatos = DPTOS.filter((id) => {
      const otros = round2(
        DPTOS.filter((o) => o !== id).reduce((s, o) => s + round2(MALAS[o]! - JUNIO[o]!), 0),
      )
      const c = proponerCorreccion(MALAS[id]!, JUNIO[id]!, PROM[id]!, 81, otros)
      return c !== null && c.valor !== MALAS[id]
    })
    expect(candidatos).toEqual(['201', '301', '401'])
    // El 301 y el 401 están bien tecleados. La regla los acusaría igual.
    expect(MALAS['301']).toBe(JULIO['301'])
    expect(MALAS['401']).toBe(JULIO['401'])
  })
})
