/**
 * Los pagos. `01-reglas-de-negocio.md` §7.
 *
 * El flujo tiene dos actores y no se pueden confundir:
 *
 *  - **El vecino avisa.** "Ya pagué" pone su pago en `aviso`. Para él deja de
 *    figurar como pendiente, pero **no suma al saldo**: es su palabra, no un
 *    depósito verificado.
 *  - **El administrador confirma**, contrastando contra el estado de cuenta del
 *    banco. Solo entonces suma al saldo, y solo entonces se avisa a los siete.
 *
 * **Bob no puede mover nada de esto.** No tiene acceso al banco.
 */

import { prisma } from '@/lib/datos/prisma'
import { nombreMes } from '@/lib/calculo/mes'
import { fmt } from '@/lib/calculo/redondeo'
import { resultadoDeMes } from '@/lib/datos/mes'
import type { DptoId, MesId } from '@/lib/calculo/tipos'
import type { AvisoPago, ConfirmarPago } from '@/lib/esquemas'
import { auditar, avisarSiPublicado } from './auditoria'
import { conflicto, noEncontrado } from './errores'

/** El vecino dice "ya pagué". No suma al saldo. */
export async function avisarPago(datos: AvisoPago) {
  return prisma.$transaction(async (tx) => {
    const dpto = await tx.departamento.findUnique({ where: { id: datos.dpto } })
    if (!dpto) throw noEncontrado(`No existe el departamento ${datos.dpto}.`)

    const anterior = await tx.pago.findUnique({
      where: { mes_dptoId: { mes: datos.mes, dptoId: datos.dpto } },
    })
    if (anterior?.estado === 'confirmado') {
      throw conflicto('Tu pago de este mes ya está confirmado.')
    }

    await tx.pago.upsert({
      where: { mes_dptoId: { mes: datos.mes, dptoId: datos.dpto } },
      create: {
        mes: datos.mes,
        dptoId: datos.dpto,
        estado: 'aviso',
        fecha: new Date(),
        operacion: datos.operacion ?? null,
        texto: datos.texto ?? null,
      },
      update: { estado: 'aviso', operacion: datos.operacion ?? null, texto: datos.texto ?? null },
    })
    await auditar(tx, {
      usuario: datos.dpto,
      accion: 'avisar',
      entidad: 'pago',
      entidadId: `${datos.mes}/${datos.dpto}`,
      campo: 'estado',
      valorAnterior: anterior?.estado ?? null,
      valorNuevo: 'aviso',
      mes: datos.mes,
    })
    // Sin aviso a los siete: es la palabra de un vecino, no un hecho verificado.
    // El administrador lo ve en su panel, en la lista de pagos por verificar.
    return { estado: 'aviso' as const }
  })
}

/**
 * El administrador confirma un pago contra el estado de cuenta.
 *
 * Requiere PIN: lo comprueba la ruta antes de llamar aquí.
 */
export async function confirmarPago(datos: ConfirmarPago) {
  const resultado = await resultadoDeMes(datos.mes as MesId)

  return prisma.$transaction(async (tx) => {
    const dpto = await tx.departamento.findUnique({ where: { id: datos.dpto } })
    if (!dpto) throw noEncontrado(`No existe el departamento ${datos.dpto}.`)

    const anterior = await tx.pago.findUnique({
      where: { mes_dptoId: { mes: datos.mes, dptoId: datos.dpto } },
    })
    if (anterior?.estado === 'confirmado') {
      throw conflicto('Ese pago ya estaba confirmado.')
    }

    const fecha = datos.fecha ? new Date(`${datos.fecha}T12:00:00Z`) : new Date()
    await tx.pago.upsert({
      where: { mes_dptoId: { mes: datos.mes, dptoId: datos.dpto } },
      create: {
        mes: datos.mes,
        dptoId: datos.dpto,
        estado: 'confirmado',
        fecha,
        monto: datos.monto ?? null,
        operacion: datos.operacion ?? anterior?.operacion ?? null,
        confirmadoPor: 'admin',
      },
      update: {
        estado: 'confirmado',
        fecha,
        monto: datos.monto ?? null,
        operacion: datos.operacion ?? anterior?.operacion ?? null,
        confirmadoPor: 'admin',
      },
    })
    await auditar(tx, {
      usuario: 'admin',
      accion: 'confirmar',
      entidad: 'pago',
      entidadId: `${datos.mes}/${datos.dpto}`,
      campo: 'estado',
      valorAnterior: anterior?.estado ?? null,
      valorNuevo: 'confirmado',
      mes: datos.mes,
    })

    // `datos.dpto` ya pasó por `zDpto` en el borde de la API; es un id de dpto real.
    const cuota = resultado.valido ? resultado.cuotas[datos.dpto as DptoId].total : null
    await avisarSiPublicado(tx, datos.mes, {
      tipo: 'pago_confirmado',
      titulo: `Se confirmó el pago del ${datos.dpto} de ${nombreMes(datos.mes as MesId)}`,
      detalle: cuota === null ? 'Ya está registrado.' : `S/ ${fmt(cuota)} · verificado contra el estado de cuenta.`,
      mes: datos.mes,
    })

    return { estado: 'confirmado' as const }
  })
}
