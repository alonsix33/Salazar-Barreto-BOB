/**
 * La auditoría y los avisos. Fase 3, puntos 4 y 5 del verificador.
 *
 * Dos reglas, y las dos son decisión del usuario:
 *
 *  - **Toda escritura deja rastro**, con `valorAnterior` y `valorNuevo`. Si una
 *    escritura no deja rastro, es un bug, no un detalle.
 *  - **Solo se avisa sobre meses publicados.** Publicar un mes genera un aviso;
 *    escribir una lectura en un mes en curso genera cero.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  guardarGastos, guardarLecturas, guardarRecibo, guardarReasignacion, publicarMes, corregirMes,
} from '@/lib/servicios/cierre'
import { guardarGastosFijos } from '@/lib/servicios/gastosFijos'
import { avisarPago, confirmarPago } from '@/lib/servicios/pagos'
import { resultadoDeMes } from '@/lib/datos/mes'
import { cargarMesEnCurso, prisma, resembrar } from './entorno'

const EN_CURSO = '2026-07'
const PUBLICADO = '2026-06'

beforeAll(async () => {
  process.env.ADMIN_PIN ??= '2026'
}, 60_000)

beforeEach(async () => {
  await resembrar()
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

const contarAvisos = () => prisma.aviso.count()
const contarAuditoria = () => prisma.auditoria.count()

describe('toda escritura deja su rastro', () => {
  it('guardar una lectura registra el valor anterior y el nuevo', async () => {
    // La primera vez es 'crear' con valorAnterior null; la segunda, 'editar'.
    await guardarLecturas(EN_CURSO, { lecturas: { '401': 438.038 } })
    const primero = await prisma.auditoria.findFirst({
      where: { entidad: 'lectura', entidadId: `${EN_CURSO}/401` },
      orderBy: { momento: 'desc' },
    })
    expect(primero!.accion).toBe('crear')
    expect(primero!.valorAnterior).toBeNull()

    const antes = await prisma.lectura.findUnique({
      where: { mes_dptoId: { mes: EN_CURSO, dptoId: '401' } },
    })
    await guardarLecturas(EN_CURSO, { lecturas: { '401': 439.5 } })

    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'lectura', entidadId: `${EN_CURSO}/401` },
      orderBy: { momento: 'desc' },
    })
    expect(apunte).not.toBeNull()
    expect(apunte!.accion).toBe('editar')
    expect(apunte!.campo).toBe('valor')
    expect(Number(apunte!.valorAnterior)).toBe(Number(String(antes!.valor)))
    expect(Number(apunte!.valorNuevo)).toBe(439.5)
    expect(apunte!.mes).toBe(EN_CURSO)
    expect(apunte!.usuario).toBe('admin')
  })

  it('guardar el recibo registra un apunte por campo que cambió, y solo por esos', async () => {
    await cargarMesEnCurso(EN_CURSO)
    const antes = await contarAuditoria()
    await guardarRecibo(EN_CURSO, { luz: 400 })
    const apuntes = await prisma.auditoria.findMany({
      where: { entidad: 'recibo', entidadId: EN_CURSO },
      orderBy: { momento: 'desc' },
    })
    expect(await contarAuditoria()).toBe(antes + 1)
    expect(apuntes[0]!.campo).toBe('luz')
    expect(Number(apuntes[0]!.valorAnterior)).toBe(361.2)
    expect(Number(apuntes[0]!.valorNuevo)).toBe(400)
  })

  it('guardar el mismo valor no inventa un apunte', async () => {
    await cargarMesEnCurso(EN_CURSO)
    await guardarRecibo(EN_CURSO, { luz: 400 })
    const antes = await contarAuditoria()
    await guardarRecibo(EN_CURSO, { luz: 400 })
    expect(await contarAuditoria()).toBe(antes)
  })

  it('los gastos puntuales dejan el antes y el después de la lista', async () => {
    await guardarGastos(EN_CURSO, {
      extras: [
        { tipo: 'gasto', concepto: 'Portón', monto: 700 },
        { tipo: 'credito', concepto: 'Devolución', monto: 50, dpto: '301' },
      ],
    })
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'gastoExtra' },
      orderBy: { momento: 'desc' },
    })
    expect(apunte!.valorNuevo).toContain('Portón')
    expect(apunte!.valorNuevo).toContain('401'.replace('401', '301'))
  })

  it('la casilla del lavado deja rastro', async () => {
    await guardarReasignacion(EN_CURSO, false)
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'reasignacionAgua' },
      orderBy: { momento: 'desc' },
    })
    expect(apunte!.campo).toBe('activa')
    expect(apunte!.valorNuevo).toBe('false')
  })

  it('avisar un pago deja rastro a nombre del vecino, no del admin', async () => {
    await avisarPago({ mes: EN_CURSO, dpto: '502', texto: 'Ya transferí' })
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'pago', entidadId: `${EN_CURSO}/502` },
      orderBy: { momento: 'desc' },
    })
    expect(apunte!.usuario).toBe('502')
    expect(apunte!.accion).toBe('avisar')
    expect(apunte!.valorNuevo).toBe('aviso')
  })

  it('confirmar un pago deja rastro a nombre del admin', async () => {
    await confirmarPago({ mes: PUBLICADO, dpto: '501' })
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'pago', entidadId: `${PUBLICADO}/501` },
      orderBy: { momento: 'desc' },
    })
    expect(apunte!.usuario).toBe('admin')
    expect(apunte!.accion).toBe('confirmar')
    expect(apunte!.valorNuevo).toBe('confirmado')
  })

  it('publicar deja rastro', async () => {
    await cargarMesEnCurso(EN_CURSO)
    await publicarMes(EN_CURSO, { notaQuePaso: 'Normal', notaQueCambio: 'Nada', notaQuePendiente: 'Nada' })
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'cierre', entidadId: EN_CURSO, accion: 'publicar' },
    })
    expect(apunte).not.toBeNull()
    expect(apunte!.valorAnterior).toBe('false')
    expect(apunte!.valorNuevo).toBe('true')
  })

  it('el descuento del recibo se guarda y baja lo que se cobra', async () => {
    /**
     * La auditoría final encontró que el descuento **no se podía teclear en
     * ninguna pantalla**: el motor y la base lo soportaban, pero la casilla no
     * existía, así que un mes con descuento se cobraba de más con los cuatro
     * cuadres en verde. Se añadió la casilla al paso 2. Este test fija el
     * recorrido entero, servicio → base → cálculo, que es lo que la casilla
     * dispara.
     */
    await cargarMesEnCurso(EN_CURSO)
    const { resultadoDeMes } = await import('@/lib/datos/mes')
    const sin = await resultadoDeMes(EN_CURSO)
    await guardarRecibo(EN_CURSO, { descuento: 20 })
    const con = await resultadoDeMes(EN_CURSO)
    // La factura baja exactamente el descuento, y con ella el total del mes.
    expect(con.facturaAgua).toBe(Math.round((sin.facturaAgua - 20) * 100) / 100)
    expect(con.totalMes).toBe(Math.round((sin.totalMes - 20) * 100) / 100)
    expect(con.descuento).toBe(20)
    expect(con.cuadra).toBe(true)
    // Y ponerlo a 0 lo borra, como dice el copy de la casilla.
    await guardarRecibo(EN_CURSO, { descuento: 0 })
    const cero = await resultadoDeMes(EN_CURSO)
    expect(cero.facturaAgua).toBe(sin.facturaAgua)
  })

  it('si una escritura falla, no deja ni rastro ni dato: la transacción se deshace', async () => {
    await cargarMesEnCurso(EN_CURSO)
    const auditoriaAntes = await contarAuditoria()
    const luzAntes = await prisma.recibo.findUnique({ where: { mes: EN_CURSO } })
    await expect(guardarRecibo(EN_CURSO, { aguaMonto: 100, descuento: 350 })).rejects.toThrow()
    expect(await contarAuditoria()).toBe(auditoriaAntes)
    const luzDespues = await prisma.recibo.findUnique({ where: { mes: EN_CURSO } })
    expect(String(luzDespues!.aguaMonto)).toBe(String(luzAntes!.aguaMonto))
  })
})

describe('los avisos solo salen de meses publicados', () => {
  it('escribir una lectura en un mes en curso NO genera ningún aviso', async () => {
    const antes = await contarAvisos()
    await guardarLecturas(EN_CURSO, { lecturas: { '401': 439.5, '101': 187.0, '201': 186.0 } })
    await guardarRecibo(EN_CURSO, { aguaM3: 81, aguaMonto: 338.6, luz: 361.2 })
    await guardarGastos(EN_CURSO, { extras: [{ tipo: 'gasto', concepto: 'Portón', monto: 700 }] })
    expect(await contarAvisos()).toBe(antes)
  })

  it('avisar un pago tampoco: es la palabra de un vecino, no un hecho', async () => {
    const antes = await contarAvisos()
    await avisarPago({ mes: EN_CURSO, dpto: '502' })
    expect(await contarAvisos()).toBe(antes)
  })

  it('publicar un mes genera exactamente UN aviso', async () => {
    await cargarMesEnCurso(EN_CURSO)
    const antes = await contarAvisos()
    await publicarMes(EN_CURSO, { notaQuePaso: 'a', notaQueCambio: 'b', notaQuePendiente: 'c' })
    expect(await contarAvisos()).toBe(antes + 1)
    const aviso = await prisma.aviso.findFirst({ orderBy: { creadoEn: 'desc' } })
    expect(aviso!.tipo).toBe('mes_publicado')
    expect(aviso!.titulo).toContain('julio')
    expect(aviso!.mes).toBe(EN_CURSO)
  })

  it('confirmar un pago de un mes publicado sí avisa', async () => {
    const antes = await contarAvisos()
    await confirmarPago({ mes: PUBLICADO, dpto: '501' })
    expect(await contarAvisos()).toBe(antes + 1)
    const aviso = await prisma.aviso.findFirst({ orderBy: { creadoEn: 'desc' } })
    expect(aviso!.tipo).toBe('pago_confirmado')
    expect(aviso!.titulo).toContain('501')
  })

  it('confirmar un pago de un mes en curso NO avisa', async () => {
    const antes = await contarAvisos()
    await confirmarPago({ mes: EN_CURSO, dpto: '401' })
    expect(await contarAvisos()).toBe(antes)
    // Pero sí deja rastro.
    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'pago', entidadId: `${EN_CURSO}/401` },
    })
    expect(apunte).not.toBeNull()
  })

  it('cambiar un gasto fijo avisa, aunque el mes no esté publicado', async () => {
    // No es una tecla del cierre: es una decisión de administración que cambia
    // lo que pagan los siete a partir de ese mes. `06` §3 lo lista aparte.
    const antes = await contarAvisos()
    await guardarGastosFijos({ cambios: [{ concepto: 'Ascensor', monto: 720 }], vigenteDesde: '2026-08' })
    expect(await contarAvisos()).toBe(antes + 1)
    const aviso = await prisma.aviso.findFirst({ orderBy: { creadoEn: 'desc' } })
    expect(aviso!.titulo).toContain('680.00')
    expect(aviso!.titulo).toContain('720.00')
  })

  it('cambiar un gasto fijo no reescribe el pasado', async () => {
    const junioAntes = await resultadoDeMes(PUBLICADO)
    await guardarGastosFijos({ cambios: [{ concepto: 'Ascensor', monto: 720 }], vigenteDesde: '2026-08' })
    const junioDespues = await resultadoDeMes(PUBLICADO)
    expect(junioDespues.totalMes).toBe(junioAntes.totalMes)
  })
})

describe('corregir un mes publicado', () => {
  it('avisa a los siete con el monto anterior y el nuevo, y queda en auditoría', async () => {
    const antes = await resultadoDeMes(PUBLICADO)
    const avisosAntes = await contarAvisos()

    await corregirMes(PUBLICADO, {
      lecturas: { '202': 35.5 },
      motivo: 'Se había tecleado mal la lectura del 202.',
    })

    expect(await contarAvisos()).toBe(avisosAntes + 1)
    const aviso = await prisma.aviso.findFirst({ orderBy: { creadoEn: 'desc' } })
    expect(aviso!.tipo).toBe('correccion')
    expect(aviso!.titulo).toContain('202')

    const despues = await resultadoDeMes(PUBLICADO)
    expect(despues.cuotas['202'].total).not.toBe(antes.cuotas['202'].total)
    // El aviso lleva el antes y el después de verdad.
    expect(aviso!.detalle).toContain(antes.cuotas['202'].total.toFixed(2))
    expect(aviso!.detalle).toContain(despues.cuotas['202'].total.toFixed(2))
    expect(aviso!.detalle).toContain('Se había tecleado mal')

    const apunte = await prisma.auditoria.findFirst({
      where: { entidad: 'lectura', entidadId: `${PUBLICADO}/202`, accion: 'corregir' },
    })
    expect(apunte).not.toBeNull()
    expect(Number(apunte!.valorNuevo)).toBe(35.5)
  })

  it('una corrección que descuadra el mes no se guarda', async () => {
    const antes = await resultadoDeMes(PUBLICADO)
    await expect(
      corregirMes(PUBLICADO, { lecturas: { '101': 1 }, motivo: 'prueba' }),
    ).rejects.toThrow()
    const despues = await resultadoDeMes(PUBLICADO)
    expect(despues.cuotas['101'].total).toBe(antes.cuotas['101'].total)
  })

  it('corregir un mes que no está publicado se rechaza: se edita desde el cierre', async () => {
    await expect(
      corregirMes(EN_CURSO, { lecturas: { '101': 187 }, motivo: 'x' }),
    ).rejects.toThrow()
  })
})

describe('un aviso de pago nunca se asciende solo a confirmado', () => {
  it('avisar dos veces lo deja en aviso, no en confirmado', async () => {
    // El caso lo destapó la prueba negativa: el camino de `create` ponía
    // `aviso`, pero el de `update` podía poner otra cosa sin que ningún test lo
    // viera. Un pago que se asciende solo suma al saldo dinero que nadie
    // verificó contra el banco.
    await avisarPago({ mes: EN_CURSO, dpto: '502', texto: 'Ya transferí' })
    const primera = await prisma.pago.findUnique({
      where: { mes_dptoId: { mes: EN_CURSO, dptoId: '502' } },
    })
    expect(primera!.estado).toBe('aviso')

    await avisarPago({ mes: EN_CURSO, dpto: '502', operacion: '0044999' })
    const segunda = await prisma.pago.findUnique({
      where: { mes_dptoId: { mes: EN_CURSO, dptoId: '502' } },
    })
    expect(segunda!.estado).toBe('aviso')
    expect(segunda!.confirmadoPor).toBeNull()
  })

  it('un pago en aviso NO suma al saldo de la cuenta', async () => {
    const { serieDelSaldo } = await import('@/lib/datos/meses')
    const antes = await serieDelSaldo()
    const junioAntes = antes.find((f) => f.mes === PUBLICADO)!

    await avisarPago({ mes: PUBLICADO, dpto: '501', texto: 'Ya transferí' })

    const despues = await serieDelSaldo()
    const junioDespues = despues.find((f) => f.mes === PUBLICADO)!
    expect(junioDespues.recibido).toBe(junioAntes.recibido)
    expect(junioDespues.saldo).toBe(junioAntes.saldo)
  })

  it('el mes en curso NO entra en el saldo hasta que se publica', async () => {
    /**
     * La auditoría final lo encontró: `serieDelSaldo` usaba los meses con
     * recibo, no los publicados. En cuanto el paso 2 del cierre guardaba el
     * recibo del mes en curso, ese mes entraba en la serie con recibido 0 y
     * gastado el total, y el saldo pegaba un salto de miles de soles que Bob
     * recitaba y el Excel exportaba, mientras Inicio enseñaba otra cifra.
     */
    const { serieDelSaldo } = await import('@/lib/datos/meses')
    const antes = await serieDelSaldo()
    expect(antes.some((f) => f.mes === EN_CURSO)).toBe(false)

    // El paso 2 del cierre: se teclea el recibo y las lecturas del mes en curso.
    await cargarMesEnCurso(EN_CURSO)

    const despues = await serieDelSaldo()
    // El mes en curso tiene datos pero no está publicado: no puede aparecer.
    expect(despues.some((f) => f.mes === EN_CURSO)).toBe(false)
    // Y el saldo del último mes publicado no se movió por tocar el mes en curso.
    const ultAntes = antes[antes.length - 1]!
    const ultDespues = despues[despues.length - 1]!
    expect(ultDespues.mes).toBe(ultAntes.mes)
    expect(ultDespues.saldo).toBe(ultAntes.saldo)
  })

  it('confirmarlo sí lo suma', async () => {
    const { serieDelSaldo } = await import('@/lib/datos/meses')
    const { resultadoDeMes: calc } = await import('@/lib/datos/mes')
    const antes = (await serieDelSaldo()).find((f) => f.mes === PUBLICADO)!
    const r = await calc(PUBLICADO)

    await confirmarPago({ mes: PUBLICADO, dpto: '501' })

    const despues = (await serieDelSaldo()).find((f) => f.mes === PUBLICADO)!
    expect(despues.recibido).toBe(
      Math.round((antes.recibido + r.cuotas['501'].total) * 100) / 100,
    )
  })
})
