/**
 * Apagar y prender un gasto fijo, sin borrar su historia.
 *
 * Antes no existía ninguna forma de que un concepto dejara de cobrarse: la
 * única opción era ponerle el monto en 0 para siempre, y se quedaba en la
 * lista de gastos de todos los meses futuros. `GastoFijo.activo` resuelve
 * eso con el mismo mecanismo de vigencia que ya usa el monto. La lógica de
 * vigencia en sí —que reactivarlo en un mes más adelante no toca el mes en
 * que estuvo apagado— ya está probada sola, sin la base, en
 * `lib/datos/__tests__/filas.test.ts`; esto prueba que la escritura de
 * verdad, contra la base, la deja tal como esa regla espera.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes } from '@/lib/datos/mes'
import { guardarGastosFijos } from '@/lib/servicios/gastosFijos'
import { round2 } from '@/lib/calculo/redondeo'
import { cargarMesEnCurso, prisma, resembrar } from './entorno'

const MES = '2026-07'

describe('activar y desactivar un gasto fijo', () => {
  beforeEach(async () => {
    await resembrar()
    await cargarMesEnCurso(MES)
  })

  it('desactivar «Insumos limpieza» lo saca de la lista y del total, desde ese mes', async () => {
    const antes = await resultadoDeMes(MES)
    if (!antes.valido) throw new Error('base no válida')
    const lineaAntes = antes.gastos.find((g) => g.concepto === 'Insumos limpieza')
    expect(lineaAntes?.monto).toBe(30)

    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: false }],
      vigenteDesde: MES,
    })

    const despues = await resultadoDeMes(MES)
    if (!despues.valido) throw new Error('después no válido')
    expect(despues.gastos.find((g) => g.concepto === 'Insumos limpieza')).toBeUndefined()
    expect(despues.totalMes).toBe(round2(antes.totalMes - 30))
    expect(despues.cuadra).toBe(true)
  })

  /**
   * El bug que esto habría dejado pasar: `guardarGastosFijos` decidía si
   * escribir algo mirando solo si el monto cambiaba (`if (de === cambio.monto)
   * continue`). Apagar un concepto sin tocar su monto —el caso normal: nadie
   * cambia el precio de la limpieza al mismo tiempo que la cancela— entraba en
   * ese `continue` y no escribía nada. La interfaz habría dicho que se guardó
   * y el concepto habría seguido cobrándose igual.
   */
  it('desactivar sin cambiar el monto sí escribe el cambio', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: false }],
      vigenteDesde: MES,
    })
    const r = await resultadoDeMes(MES)
    if (!r.valido) throw new Error('no válido')
    expect(r.gastos.find((g) => g.concepto === 'Insumos limpieza')).toBeUndefined()
  })

  it('reactivarlo en el mismo mes sin cerrar lo trae de vuelta', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: false }],
      vigenteDesde: MES,
    })
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: true }],
      vigenteDesde: MES,
    })
    const r = await resultadoDeMes(MES)
    if (!r.valido) throw new Error('no válido')
    expect(r.gastos.find((g) => g.concepto === 'Insumos limpieza')?.monto).toBe(30)
  })

  it('deja rastro en Auditoria, como toda escritura', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: false }],
      vigenteDesde: MES,
    })
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'gastoFijo', campo: 'activo' },
      orderBy: { momento: 'desc' },
    })
    expect(apunte?.valorNuevo).toBe('inactivo')
  })
})

describe('marcar o desmarcar «es anual» sin cambiar el monto', () => {
  beforeEach(async () => {
    await resembrar()
    await cargarMesEnCurso(MES)
  })

  /**
   * La misma familia de bug que el `activo`: la condición de "no hay nada que
   * guardar" solo miraba el monto. Marcar «Insumos limpieza» como anual sin
   * tocar sus S/ 30 es justo el caso normal —nadie cambia el precio al mismo
   * tiempo que decide que se paga de una vez al año—.
   */
  it('marcarlo como anual sin cambiar el monto sí escribe el cambio', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, anual: true }],
      vigenteDesde: MES,
    })
    const r = await resultadoDeMes(MES)
    if (!r.valido) throw new Error('no válido')
    expect(r.gastos.find((g) => g.concepto === 'Insumos limpieza')?.anual).toBe(true)
  })

  it('el aviso dice que ahora se divide entre 12, no «pasó de S/30 a S/30»', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, anual: true }],
      vigenteDesde: MES,
    })
    const aviso = await prisma.aviso.findFirst({
      where: { tipo: 'gasto_fijo', titulo: { contains: 'Insumos limpieza' } },
      orderBy: { creadoEn: 'desc' },
    })
    expect(aviso?.titulo).toContain('dividido entre 12')
  })
})

/**
 * Encontrado por un verificador adversarial: cuando `activo`/`anual` y
 * `monto` cambiaban en la misma llamada, `guardarGastosFijos` elegía un solo
 * campo para auditar (el de mayor prioridad) y un solo fragmento para el
 * aviso, y el resto del cambio quedaba sin rastro y sin avisar. Hoy el panel
 * nunca manda los dos juntos, pero la ruta pública `/api/gastos-fijos` no lo
 * impide.
 */
describe('activo/anual y monto cambiando en la misma llamada', () => {
  beforeEach(async () => {
    await resembrar()
    await cargarMesEnCurso(MES)
  })

  it('reactivar subiendo el monto a la vez audita los dos campos, no solo activo', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: false }],
      vigenteDesde: MES,
    })
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 45, activo: true }],
      vigenteDesde: MES,
    })
    const apuntes = await prisma.auditoria.findMany({
      where: { entidad: 'gastoFijo', entidadId: `Insumos limpieza@${MES}`, campo: { in: ['monto', 'activo'] } },
      orderBy: { momento: 'asc' },
    })
    // La última escritura tuvo que dejar UN apunte de `monto` (30 → 45) y
    // UNO de `activo` (inactivo → activo), no solo el de mayor prioridad.
    const deLaUltima = apuntes.filter((a) => Number(a.valorNuevo) === 45 || a.valorNuevo === 'activo')
    expect(deLaUltima.map((a) => a.campo).sort()).toEqual(['activo', 'monto'])
  })

  it('reactivar subiendo el monto a la vez lo dice completo en el aviso', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 30, activo: false }],
      vigenteDesde: MES,
    })
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 45, activo: true }],
      vigenteDesde: MES,
    })
    const aviso = await prisma.aviso.findFirst({
      where: { tipo: 'gasto_fijo', titulo: { contains: 'vuelve a cobrarse' } },
      orderBy: { creadoEn: 'desc' },
    })
    expect(aviso?.titulo).toContain('vuelve a cobrarse')
    expect(aviso?.titulo).toContain('45')
  })

  it('marcar anual subiendo el monto a la vez lo dice completo, no solo «pasa de S/A a S/B»', async () => {
    await guardarGastosFijos({
      cambios: [{ concepto: 'Insumos limpieza', monto: 40, anual: true }],
      vigenteDesde: MES,
    })
    const aviso = await prisma.aviso.findFirst({
      where: { tipo: 'gasto_fijo', titulo: { contains: 'Insumos limpieza' } },
      orderBy: { creadoEn: 'desc' },
    })
    expect(aviso?.titulo).toContain('dividido entre 12')
    expect(aviso?.titulo).toContain('40')
  })
})
