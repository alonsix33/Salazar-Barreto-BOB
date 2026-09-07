/**
 * Una corrección **recupera** el lavado que no cupo al publicar, con el m³
 * congelado.
 *
 * El defecto que este fichero cierra: al publicar se grababa `activa =
 * resultado.lavado > 0`, es decir el **resultado** («cupo o no cupo»), no la
 * **intención** («el admin marcó la casilla»). Un mes publicado con la casilla
 * marcada pero con poca área común —el lavado no cabía— quedaba `activa:false,
 * m3:null`, y una corrección posterior que restaurara el área común no
 * recuperaba nunca el lavado: el 401 seguía pagando de menos y los otros seis,
 * de más, para siempre.
 *
 * La decisión de producto (Q1): al corregir se re-evalúa si el lavado cabe con
 * **los m³ congelados al publicar**, no con el global de hoy. Este test lo
 * comprueba de las dos formas: que el lavado vuelve, y que vuelve con 1.50 (el
 * congelado) aunque el global se haya movido a 3.00 entremedias.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resultadoDeMes } from '@/lib/datos/mes'
import {
  guardarReasignacion,
  guardarRecibo,
  publicarMes,
  corregirMes,
} from '@/lib/servicios/cierre'
import { round2 } from '@/lib/calculo/redondeo'
import { LAVADO } from '@/lib/calculo/constantes'
import { cargarMesEnCurso, prisma, resembrar } from './entorno'

const EN_CURSO = '2026-07'

/** Lo que hace el botón «Cambiar el consumo» del panel: mueve el m³ global. */
async function cambiarLavadoGlobal(m3: number): Promise<void> {
  await prisma.reasignacionAgua.updateMany({ data: { m3 } })
}

describe('el lavado que no cupo al publicar se recupera al corregir', () => {
  beforeEach(async () => {
    await resembrar()
    await cargarMesEnCurso(EN_CURSO)
  })

  it('conserva la intención al congelar, y una corrección lo re-aplica con el m³ congelado', async () => {
    // ── 1. Casilla del lavado marcada (intención on) ─────────────────────
    await guardarReasignacion(EN_CURSO, true)

    // ── 2. Estrujar el área común por debajo del umbral del lavado ───────
    // brutoComun = aguaM3 − sumaMedida. Bajando aguaM3 dejo el común en 1.0 m³
    // (< 1.5), así el lavado **no cabe**. El monto de la factura no cambia.
    const base = await resultadoDeMes(EN_CURSO)
    if (!base.valido) throw new Error(`base inválida: ${base.motivoInvalido}`)
    const aguaM3Estrujada = round2(base.rec.aguaM3 - (base.brutoComun - 1.0))
    await guardarRecibo(EN_CURSO, {
      aguaM3: aguaM3Estrujada,
      aguaMonto: base.rec.aguaMonto,
      luz: base.rec.luz,
      descuento: base.rec.descuento ?? null,
    })

    const noCupo = await resultadoDeMes(EN_CURSO)
    if (!noCupo.valido) throw new Error(`no-cupo inválido: ${noCupo.motivoInvalido}`)
    expect(noCupo.lavado).toBe(0) // el lavado no cabe en 1.0 m³ de común
    expect(noCupo.cuadra).toBe(true) // pero el mes cuadra igual

    // Guardo la lectura de un vecino para poder «corregirla» luego.
    const lecturaOriginal502 = noCupo.cuotas['502'].lecturaActual

    // ── 3. Publicar ─────────────────────────────────────────────────────
    await publicarMes(EN_CURSO, { notaQuePaso: 'x', notaQueCambio: 'x', notaQuePendiente: 'x' })

    // La marca congelada guarda la INTENCIÓN, no el resultado.
    const marca = await prisma.reasignacionActivaEnMes.findFirst({ where: { mes: EN_CURSO } })
    expect(marca?.activa).toBe(true) // marcada, aunque el lavado no cupo
    expect(marca?.m3).not.toBeNull() // el precio se congela igual
    expect(Number(marca?.m3)).toBe(LAVADO.m3) // y es 1.50, el de cuando se publicó

    // ── 4. El global se mueve a 3.00 (no debe filtrarse al mes publicado) ─
    await cambiarLavadoGlobal(3.0)

    // ── 5. Corregir: bajar la lectura del 502 devuelve área común ────────
    // −4 m³ de consumo medido ⇒ +4 m³ de común ⇒ pasa de 1.0 a ~5.0, y el
    // lavado (1.5) ya cabe.
    await corregirMes(EN_CURSO, {
      lecturas: { '502': lecturaOriginal502 - 4 },
      motivo: 'La lectura del 502 estaba mal: era menos, y sobra más agua común.',
    })

    const despues = await resultadoDeMes(EN_CURSO)
    if (!despues.valido) throw new Error(`corregido inválido: ${despues.motivoInvalido}`)

    // El lavado VOLVIÓ…
    expect(despues.lavado).toBeGreaterThan(0)
    // …y con el m³ CONGELADO (1.50), no con el global de hoy (3.00).
    expect(despues.lavado).toBe(LAVADO.m3)
  })
})
