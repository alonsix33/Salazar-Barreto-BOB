/**
 * La auditoría y los avisos.
 *
 * **Toda escritura escribe en `Auditoria`, en la misma transacción. Sin
 * excepción.** Es decisión del usuario y no es negociable (`06` §3).
 *
 * Los avisos son otra cosa y la distinción gobierna todo el backend:
 *
 * > **Solo se avisa sobre meses publicados.** Escribir en un mes en curso no
 * > notifica a nadie.
 *
 * Sin eso, cerrar el mes serían doscientas notificaciones: siete lecturas con
 * dos correcciones cada una, cuatro campos de recibo, diez gastos fijos, cada
 * tecla avisando a siete personas. La campana se volvería ruido, la gente la
 * apagaría, y el aviso que sí importa —"ya está el cierre de julio"— llegaría a
 * una campana que nadie mira. Todo queda registrado igual; lo que se filtra es
 * qué merece interrumpir a siete personas.
 */

import type { Prisma, TipoAviso } from '@prisma/client'

/** Una transacción de Prisma. Todas las funciones de servicio reciben una. */
export type Tx = Prisma.TransactionClient

export interface ApunteAuditoria {
  usuario: string
  accion: 'crear' | 'editar' | 'borrar' | 'publicar' | 'corregir' | 'confirmar' | 'avisar'
  entidad: string
  entidadId?: string | null
  campo?: string | null
  valorAnterior?: string | number | null
  valorNuevo?: string | number | null
  mes?: string | null
}

const texto = (v: string | number | null | undefined): string | null =>
  v === null || v === undefined ? null : String(v)

/** Deja el rastro de una escritura. Va siempre dentro de la transacción. */
export async function auditar(tx: Tx, apunte: ApunteAuditoria): Promise<void> {
  await tx.auditoria.create({
    data: {
      usuario: apunte.usuario,
      accion: apunte.accion,
      entidad: apunte.entidad,
      entidadId: apunte.entidadId ?? null,
      campo: apunte.campo ?? null,
      valorAnterior: texto(apunte.valorAnterior),
      valorNuevo: texto(apunte.valorNuevo),
      mes: apunte.mes ?? null,
    },
  })
}

/** Varios apuntes de una vez, para una escritura que toca varios campos. */
export async function auditarVarios(tx: Tx, apuntes: readonly ApunteAuditoria[]): Promise<void> {
  for (const a of apuntes) await auditar(tx, a)
}

export interface AvisoNuevo {
  tipo: TipoAviso
  titulo: string
  detalle: string
  mes?: string | null
}

/**
 * Crea un aviso para los siete.
 *
 * Llamar solo cuando corresponde: publicar un mes, confirmar un pago, corregir
 * un mes ya publicado, cambiar un gasto fijo, o activar/desactivar una
 * reasignación. Ver `avisarSiPublicado`.
 */
export async function avisar(tx: Tx, aviso: AvisoNuevo): Promise<void> {
  await tx.aviso.create({
    data: {
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      detalle: aviso.detalle,
      mes: aviso.mes ?? null,
    },
  })
}

/**
 * Crea el aviso **solo si el mes ya estaba publicado**.
 *
 * Es la regla de `06` §3 metida en una función, para que no dependa de que
 * cada endpoint se acuerde.
 */
export async function avisarSiPublicado(tx: Tx, mes: string, aviso: AvisoNuevo): Promise<boolean> {
  const cierre = await tx.cierre.findUnique({ where: { mes }, select: { publicado: true } })
  if (!cierre?.publicado) return false
  await avisar(tx, aviso)
  return true
}
