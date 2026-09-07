/**
 * Dos pestañas escribiendo el mismo mes.
 *
 * Es un caso real: el administrador abre el cierre en el móvil y lo sigue en la
 * laptop. Sin bloqueo, una de las dos pierde lo que escribió **en silencio**,
 * que es lo peor que puede pasar: nadie se entera hasta que las cuotas salen
 * mal.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { guardarLecturas, guardarRecibo } from '@/lib/servicios/cierre'
import { ErrorDeApi } from '@/lib/servicios/errores'
import { borradorDeMes } from '@/lib/datos/meses'
import { prisma, resembrar } from './entorno'

const EN_CURSO = '2026-07'

beforeEach(async () => {
  await resembrar()
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

describe('bloqueo optimista', () => {
  it('la segunda pestaña, con la versión vieja, recibe 409 y no pisa a la primera', async () => {
    const inicial = await borradorDeMes(EN_CURSO)

    // Las dos pestañas leyeron la misma versión.
    const versionCompartida = inicial.version

    await guardarLecturas(EN_CURSO, { lecturas: { '401': 439.0 }, version: versionCompartida })

    let error: ErrorDeApi | null = null
    try {
      await guardarLecturas(EN_CURSO, { lecturas: { '401': 999.0 }, version: versionCompartida })
    } catch (e) {
      error = e as ErrorDeApi
    }

    expect(error).not.toBeNull()
    expect(error!.estado).toBe(409)
    expect(error!.message).toContain('Recarga')

    // Y lo que quedó guardado es lo de la primera, no lo de la segunda.
    const lectura = await prisma.lectura.findUnique({
      where: { mes_dptoId: { mes: EN_CURSO, dptoId: '401' } },
    })
    expect(Number(String(lectura!.valor))).toBe(439.0)
  })

  it('con la versión al día, la segunda escritura sí entra', async () => {
    const primera = await guardarLecturas(EN_CURSO, { lecturas: { '401': 439.0 }, version: 0 })
    await guardarLecturas(EN_CURSO, { lecturas: { '401': 440.0 }, version: primera.version })
    const lectura = await prisma.lectura.findUnique({
      where: { mes_dptoId: { mes: EN_CURSO, dptoId: '401' } },
    })
    expect(Number(String(lectura!.valor))).toBe(440.0)
  })

  it('sin mandar versión no se comprueba: es para escrituras de fuera del cierre', async () => {
    await guardarRecibo(EN_CURSO, { luz: 370 })
    await guardarRecibo(EN_CURSO, { luz: 380 })
    const recibo = await prisma.recibo.findUnique({ where: { mes: EN_CURSO } })
    expect(Number(String(recibo!.luz))).toBe(380)
  })

  it('la versión sube en cada escritura', async () => {
    const antes = (await borradorDeMes(EN_CURSO)).version
    await guardarLecturas(EN_CURSO, { lecturas: { '401': 439.0 } })
    await guardarRecibo(EN_CURSO, { luz: 370 })
    const despues = (await borradorDeMes(EN_CURSO)).version
    expect(despues).toBe(antes + 2)
  })

  it('dos escrituras simultáneas de verdad: una gana, la otra recibe 409', async () => {
    const version = (await borradorDeMes(EN_CURSO)).version
    const resultados = await Promise.allSettled([
      guardarLecturas(EN_CURSO, { lecturas: { '101': 187.0 }, version }),
      guardarLecturas(EN_CURSO, { lecturas: { '101': 188.0 }, version }),
    ])
    const cumplidas = resultados.filter((r) => r.status === 'fulfilled')
    const rechazadas = resultados.filter((r) => r.status === 'rejected')
    expect(cumplidas).toHaveLength(1)
    expect(rechazadas).toHaveLength(1)
    // Y la que perdió no dejó nada a medias.
    const apuntes = await prisma.auditoria.count({
      where: { entidad: 'lectura', entidadId: `${EN_CURSO}/101` },
    })
    expect(apuntes).toBe(1)
  })
})
