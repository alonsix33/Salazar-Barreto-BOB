import { fijosVigentesEn } from '@/lib/datos/mes'
import { mesesConDatos } from '@/lib/datos/meses'
import { guardarGastosFijos } from '@/lib/servicios/gastosFijos'
import { zGuardarGastosFijos } from '@/lib/esquemas'
import { exigirAdmin, leerCuerpo, responder } from '@/lib/servicios/ruta'
import type { MesId } from '@/lib/calculo/tipos'

/** `GET /api/gastos-fijos` · los conceptos vigentes hoy. */
export async function GET() {
  return responder(async () => {
    const meses = await mesesConDatos()
    const ultimo = (meses[meses.length - 1] ?? '2026-01') as MesId
    return { vigenteEn: ultimo, gastos: await fijosVigentesEn(ultimo) }
  })
}

/** `PUT /api/gastos-fijos` · editar montos. Aplica desde `vigenteDesde`. */
export async function PUT(peticion: Request) {
  return responder(async () => {
    await exigirAdmin()
    return guardarGastosFijos(await leerCuerpo(peticion, zGuardarGastosFijos))
  })
}
