/**
 * Cambiar el consumo del lavado **no puede mover un mes ya publicado**.
 *
 * El defecto que este fichero cierra: los m³ del lavado vivían en un único campo
 * global (`ReasignacionAgua.m3`) y `lavadoM3En()` lo leía para cualquier mes. El
 * marcador por mes solo guardaba un booleano. Subirlos de 1.50 a 3.00 desde el
 * panel movía la cuota de junio de 2026 del 401 en S/ 6.25 —un mes cerrado,
 * publicado y avisado a los siete— mientras el aviso que salía por ese mismo
 * botón decía «los meses ya cerrados no se tocan».
 *
 * Nada estaba en rojo: los dos cuadres se cumplen igual con el reparto nuevo,
 * porque son identidades algebraicas. La única forma de verlo es comparar la
 * cuota **antes y después** de tocar el valor.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes } from '@/lib/datos/mes'
import { publicarMes } from '@/lib/servicios/cierre'
import { cargarMesEnCurso, prisma, resembrar } from './entorno'

const PUBLICADO = '2026-06'
const EN_CURSO = '2026-07'

async function cuotaDel401(mes: string): Promise<number> {
  const r = await resultadoDeMes(mes as never)
  if (!r.valido) throw new Error(`${mes} salió inválido: ${r.motivoInvalido}`)
  return r.cuotas['401'].total
}

/** Lo que hace el botón «Cambiar el consumo» del panel. */
async function cambiarLavado(m3: number): Promise<void> {
  await prisma.reasignacionAgua.updateMany({ data: { m3 } })
}

describe('los m³ del lavado se congelan al publicar', () => {
  beforeEach(async () => {
    await resembrar()
  })

  it('un mes publicado no se mueve aunque se cambie el consumo', async () => {
    const antes = await cuotaDel401(PUBLICADO)
    await cambiarLavado(3.0)
    expect(await cuotaDel401(PUBLICADO)).toBe(antes)
  })

  it('y el área común de ese mes tampoco', async () => {
    const antes = await resultadoDeMes(PUBLICADO)
    await cambiarLavado(3.0)
    const despues = await resultadoDeMes(PUBLICADO)
    expect(antes.valido && despues.valido).toBe(true)
    if (antes.valido && despues.valido) {
      expect(despues.comunReal).toBe(antes.comunReal)
      expect(despues.lavado).toBe(antes.lavado)
      expect(despues.totalMes).toBe(antes.totalMes)
    }
  })

  it('el mes que todavía no se ha publicado sí sigue el valor nuevo', async () => {
    await cargarMesEnCurso(EN_CURSO)
    const antes = await resultadoDeMes(EN_CURSO)
    await cambiarLavado(3.0)
    const despues = await resultadoDeMes(EN_CURSO)
    expect(antes.valido && despues.valido).toBe(true)
    if (antes.valido && despues.valido) {
      expect(despues.lavado).toBe(3)
      expect(antes.lavado).toBe(1.5)
      // El total del edificio no cambia: el lavado solo mueve agua de bolsillo.
      expect(despues.totalMes).toBe(antes.totalMes)
      expect(despues.cuotas['401'].total).toBeGreaterThan(antes.cuotas['401'].total)
    }
  })

  it('publicar congela el valor con el que se publicó', async () => {
    await cargarMesEnCurso(EN_CURSO)
    await publicarMes(EN_CURSO as never, {
      notaQuePaso: '',
      notaQueCambio: '',
      notaQuePendiente: '',
    })
    const alPublicar = await cuotaDel401(EN_CURSO)

    await cambiarLavado(3.0)
    expect(await cuotaDel401(EN_CURSO)).toBe(alPublicar)

    // Y queda escrito, no solo calculado: se puede auditar sin recalcular nada.
    const marca = await prisma.reasignacionActivaEnMes.findFirst({ where: { mes: EN_CURSO } })
    expect(marca).not.toBeNull()
    expect(Number(marca!.m3)).toBe(1.5)
  })

  it('el borrador dice si el lavado se aplicó, no solo si está activado', async () => {
    /**
     * `01` §3.3: el lavado puede estar activado y aun así no aplicarse si no hay
     * bastante área común. «La app lo dice explícitamente en pantalla», y para
     * decirlo el borrador distingue `activo` (el interruptor) de `aplicado` (lo
     * que de verdad pasó). La auditoría final encontró que la casilla del paso 5
     * decía «activo · se descuenta del área común» aun cuando no se descontó.
     */
    const { borradorDeMes } = await import('@/lib/datos/meses')

    // Un mes normal: el lavado está activado y se aplica.
    await cargarMesEnCurso(EN_CURSO)
    const normal = await borradorDeMes(EN_CURSO as never)
    expect(normal.lavado!.activo).toBe(true)
    expect(normal.lavado!.aplicado).toBe(true)

    // Bajamos los m³ de SEDAPAL por debajo de lo que midieron los medidores: el
    // mes pasa a reparto ajustado, y `01` §3.3 dice que ahí el lavado no aplica.
    // El interruptor sigue puesto; lo que cambia es que ya no hay de dónde sacarlo.
    const { guardarRecibo } = await import('@/lib/servicios/cierre')
    await guardarRecibo(EN_CURSO as never, { aguaM3: 1 })

    const apretado = await borradorDeMes(EN_CURSO as never)
    expect(apretado.resultado.valido && apretado.resultado.ajustado).toBe(true)
    expect(apretado.lavado!.activo).toBe(true)      // el interruptor sigue puesto
    expect(apretado.lavado!.aplicado).toBe(false)   // pero no se aplicó
  })

  it('un mes desmarcado se congela sin m³, no con los del mes siguiente', async () => {
    await cargarMesEnCurso(EN_CURSO)
    const reasignacion = await prisma.reasignacionAgua.findFirstOrThrow()
    await prisma.reasignacionActivaEnMes.upsert({
      where: { reasignacionId_mes: { reasignacionId: reasignacion.id, mes: EN_CURSO } },
      create: { reasignacionId: reasignacion.id, mes: EN_CURSO, activa: false },
      update: { activa: false, m3: null },
    })
    await publicarMes(EN_CURSO as never, {
      notaQuePaso: '',
      notaQueCambio: '',
      notaQuePendiente: '',
    })
    const marca = await prisma.reasignacionActivaEnMes.findFirstOrThrow({ where: { mes: EN_CURSO } })
    expect(marca.activa).toBe(false)
    expect(marca.m3).toBeNull()

    await cambiarLavado(3.0)
    const r = await resultadoDeMes(EN_CURSO as never)
    expect(r.valido && r.lavado).toBe(0)
  })
})
