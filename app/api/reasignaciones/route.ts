import { prisma } from '@/lib/datos/prisma'
import { aDecimal2, aNumeroObligatorio } from '@/lib/datos/decimal'
import { auditar, avisar } from '@/lib/servicios/auditoria'
import { noEncontrado } from '@/lib/servicios/errores'
import { zConfigurarLavado } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder } from '@/lib/servicios/ruta'
import { fmt } from '@/lib/calculo/redondeo'

/**
 * `PUT /api/reasignaciones` · cambiar los m³ del lavado.
 *
 * Cambia lo que se le cobra al 401 **de aquí en adelante**, así que **avisa a
 * los siete**: `06` §3 lista las reasignaciones entre lo que genera aviso.
 *
 * Los meses ya publicados no se mueven porque al publicarlos se congelaron sus
 * m³ (`ReasignacionActivaEnMes.m3`). Antes de eso el valor era global y esto
 * reescribía el pasado en silencio: subirlo de 1.50 a 3.00 movía la cuota de
 * junio del 401 en S/ 6.25, con el aviso diciendo lo contrario.
 */
export async function PUT(peticion: Request) {
  return responder(async () => {
    await exigirAdmin()
    const { m3 } = await leerCuerpo(peticion, zConfigurarLavado)

    return prisma.$transaction(async (tx) => {
      // Con orden y no al azar: hoy hay una sola reasignación, pero un
      // `findFirst` sin `orderBy` edita cualquiera de las que haya el día que
      // haya dos, y el resto del código lee esta tabla siempre ordenada.
      const reasignacion = await tx.reasignacionAgua.findFirst({
        orderBy: [{ desde: 'desc' }, { creadoEn: 'desc' }],
      })
      if (!reasignacion) throw noEncontrado('No hay ninguna reasignación configurada.')
      const antes = aNumeroObligatorio(reasignacion.m3)
      if (antes === m3) return { m3, cambio: false }

      await tx.reasignacionAgua.update({ where: { id: reasignacion.id }, data: { m3: aDecimal2(m3) } })
      await auditar(tx, {
        usuario: 'admin',
        accion: 'editar',
        entidad: 'reasignacionAgua',
        entidadId: reasignacion.id,
        campo: 'm3',
        valorAnterior: antes,
        valorNuevo: m3,
      })
      await avisar(tx, {
        tipo: 'reasignacion',
        titulo: `El ${reasignacion.concepto} del ${reasignacion.dptoId} pasa de ${fmt(antes)} a ${fmt(m3)} m³`,
        detalle:
          'Se sigue restando del área común y sumando al departamento: el total del edificio no cambia. Aplica desde el mes que se está cerrando; los meses ya publicados quedaron como estaban.',
      })
      return { m3, cambio: true }
    })
  })
}
