/**
 * El aviso de corrección cita la instantánea, y la instantánea se mantiene.
 *
 * `Cierre.instantanea` es la única cuota que se guarda (`06` §2): la que el
 * vecino vio al publicarse el mes. El aviso «tu cuota pasó de X a Y» usa ese X, y
 * cada corrección reescribe la instantánea con su resultado, así que la próxima
 * corrección parte de lo último que se comunicó, no del recálculo.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes } from '@/lib/datos/mes'
import { corregirMes } from '@/lib/servicios/cierre'
import { fmt } from '@/lib/calculo/redondeo'
import type { ResultadoMes } from '@/lib/calculo/tipos'
import { prisma, resembrar } from './entorno'

const MES = '2026-06'

async function instantaneaDe(): Promise<ResultadoMes> {
  const c = await prisma.cierre.findUniqueOrThrow({ where: { mes: MES } })
  return c.instantanea as unknown as ResultadoMes
}

async function ultimoAvisoCorreccion(): Promise<string> {
  const a = await prisma.aviso.findFirstOrThrow({
    where: { mes: MES, tipo: 'correccion' },
    orderBy: { creadoEn: 'desc' },
  })
  return a.detalle ?? ''
}

describe('la corrección usa y mantiene la instantánea', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('el aviso cita la cuota publicada, y la instantánea queda con la corregida', async () => {
    const publicado = await resultadoDeMes(MES)
    if (!publicado.valido) throw new Error('junio no válido')
    const lecturaOriginal = publicado.cuotas['502'].lecturaActual

    await corregirMes(MES, {
      lecturas: { '502': lecturaOriginal - 5 },
      motivo: 'La lectura del 502 estaba alta.',
    })

    const corregido = await resultadoDeMes(MES)
    if (!corregido.valido) throw new Error('corregido no válido')

    // La instantánea se actualizó al resultado corregido.
    const snap = await instantaneaDe()
    expect(snap.totalMes).toBe(corregido.totalMes)
    expect(snap.cuotas['502'].total).toBe(corregido.cuotas['502'].total)

    // El aviso citó el «de» publicado (no el corregido) para el 502.
    const detalle = await ultimoAvisoCorreccion()
    expect(detalle).toContain(`El 502 pasó de S/ ${fmt(publicado.cuotas['502'].total)}`)
  })

  it('en una segunda corrección, el «de» es lo de la primera, no lo publicado', async () => {
    const publicado = await resultadoDeMes(MES)
    if (!publicado.valido) throw new Error('junio no válido')
    const l0 = publicado.cuotas['502'].lecturaActual

    await corregirMes(MES, { lecturas: { '502': l0 - 5 }, motivo: 'primera' })
    const trasUno = (await resultadoDeMes(MES)) as ResultadoMes & { valido: true }
    const cuotaUno = trasUno.cuotas['502'].total

    await corregirMes(MES, { lecturas: { '502': l0 - 9 }, motivo: 'segunda' })

    const detalle = await ultimoAvisoCorreccion()
    // El «de» de la segunda corrección es la cuota que dejó la primera…
    expect(detalle).toContain(`El 502 pasó de S/ ${fmt(cuotaUno)}`)
    // …y NO la cuota publicada original.
    expect(detalle).not.toContain(`de S/ ${fmt(publicado.cuotas['502'].total)}`)
  })
})
