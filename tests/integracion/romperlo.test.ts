/**
 * Intentar romperlo. Fase 3, punto 3 del verificador.
 *
 * Cada uno de estos tiene que devolver **un error claro con su código HTTP**,
 * nunca un 500 ni un registro corrupto en la base. Un 500 es un bug que se nos
 * escapó, no una forma de contestar.
 *
 * Se prueban los servicios, que es donde vive la regla, y además los esquemas
 * Zod, que son el borde. Los dos, porque el borde puede cambiar y la regla tiene
 * que seguir en pie.
 */

import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  zAvisoPago, zConfirmarPago, zCorregir, zGuardarGastos, zGuardarLecturas,
  zGuardarRecibo, zMes, zPublicar, zValidarPin,
} from '@/lib/esquemas'
import { guardarGastos, guardarLecturas, guardarRecibo, publicarMes } from '@/lib/servicios/cierre'
import { guardarGastosFijos } from '@/lib/servicios/gastosFijos'
import { avisarPago, confirmarPago } from '@/lib/servicios/pagos'
import { validarPin, sesionValida } from '@/lib/servicios/admin'
import { ErrorDeApi } from '@/lib/servicios/errores'
import { resultadoDeMes } from '@/lib/datos/mes'
import { cargarMesEnCurso, prisma, resembrar } from './entorno'

const EN_CURSO = '2026-07'
const PUBLICADO = '2026-06'

beforeAll(async () => {
  process.env.ADMIN_PIN ??= '2026'
  await resembrar()
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

/**
 * Exige que la base rechace algo **por la restricción que se dice probar**.
 *
 * `rejects.toThrow()` a secas pasa con cualquier error: un «record not found»
 * porque la fila no existía, un `TypeError` por un campo mal escrito, o la
 * propia base caída. Cuatro tests de este fichero decían probar un CHECK y solo
 * probaban que algo saltó — si el CHECK desapareciera, seguirían en verde.
 */
async function laBaseLoRechazaPor(accion: () => Promise<unknown>, restriccion: string): Promise<void> {
  try {
    await accion()
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e)
    if (texto.includes(restriccion)) return
    throw new Error(`Se esperaba que fallara por "${restriccion}" y falló por otra cosa:\n${texto}`)
  }
  throw new Error(`Se esperaba que la base rechazara por "${restriccion}" y no rechazó nada`)
}

/** Ejecuta y devuelve el `ErrorDeApi`, o falla si no hubo error. */
async function falla(accion: () => Promise<unknown>): Promise<ErrorDeApi> {
  try {
    await accion()
  } catch (e) {
    if (e instanceof ErrorDeApi) return e
    throw new Error(`Se esperaba un ErrorDeApi y llegó: ${String(e)}`)
  }
  throw new Error('Se esperaba un error y no hubo ninguno')
}

describe('un mes con formato inválido', () => {
  for (const malo of ['2026-13', 'junio', '', '2026-6', '26-06', 'DROP TABLE recibo']) {
    it(`${JSON.stringify(malo)} lo rechaza el esquema`, () => {
      expect(zMes.safeParse(malo).success).toBe(false)
    })
  }

  it('2026-07 sí es válido', () => {
    expect(zMes.safeParse('2026-07').success).toBe(true)
  })
})

describe('una lectura menor que la del mes anterior', () => {
  it('se guarda, pero el mes deja de cuadrar y no se puede publicar', async () => {
    // Guardarla está permitido: el medidor pudo cambiarse. Lo que no puede pasar
    // es que se publique un mes con un consumo negativo, que es lo que producía
    // una cuota de S/ -375.05 con los dos cuadres en verde.
    await cargarMesEnCurso(EN_CURSO)
    const antes = await resultadoDeMes(EN_CURSO)
    expect(antes.cuadra).toBe(true)

    await guardarLecturas(EN_CURSO, { lecturas: { '101': 1 } })
    const despues = await resultadoDeMes(EN_CURSO)
    expect(despues.consumos['101']).toBeLessThan(0)
    expect(despues.cuadraSanidad).toBe(false)
    expect(despues.cuadra).toBe(false)

    const error = await falla(() =>
      publicarMes(EN_CURSO, { notaQuePaso: 'x', notaQueCambio: 'x', notaQuePendiente: 'x' }),
    )
    expect(error.estado).toBe(409)
    expect(error.message).toContain('no cuadra')

    // Restaurar
    await guardarLecturas(EN_CURSO, { lecturas: { '101': 186.461 } })
    expect((await resultadoDeMes(EN_CURSO)).cuadra).toBe(true)
  })
})

describe('un monto negativo', () => {
  it('lo rechaza el esquema del recibo', () => {
    const r = zGuardarRecibo.safeParse({ aguaMonto: -100 })
    expect(r.success).toBe(false)
  })

  it('lo rechaza el esquema de las lecturas', () => {
    expect(zGuardarLecturas.safeParse({ lecturas: { '101': -5 } }).success).toBe(false)
  })

  it('lo rechaza el esquema de los gastos', () => {
    expect(
      zGuardarGastos.safeParse({ extras: [{ tipo: 'gasto', concepto: 'x', monto: -1 }] }).success,
    ).toBe(false)
  })

  it('la base lo rechaza aunque el servicio se olvidara', async () => {
    await laBaseLoRechazaPor(
      () => prisma.recibo.update({ where: { mes: EN_CURSO }, data: { aguaMonto: -1 } }),
      'agua_monto_no_negativo',
    )
  })
})

describe('un descuento mayor que el monto de la factura', () => {
  it('el servicio lo rechaza con 400 y un mensaje que se entiende', async () => {
    const error = await falla(() => guardarRecibo(EN_CURSO, { aguaMonto: 100, descuento: 350 }))
    expect(error.estado).toBe(400)
    expect(error.message).toContain('descuento')
  })

  it('la base también, por si acaso', async () => {
    await laBaseLoRechazaPor(
      () => prisma.recibo.update({ where: { mes: EN_CURSO }, data: { descuento: 99999 } }),
      'descuento_no_supera_el_monto',
    )
  })
})

describe('un departamento que no existe', () => {
  it('lo rechaza el esquema del aviso de pago', () => {
    expect(zAvisoPago.safeParse({ mes: '2026-07', dpto: '999' }).success).toBe(false)
  })

  it('lo rechaza el esquema de las lecturas', () => {
    expect(zGuardarLecturas.safeParse({ lecturas: { '999': 100 } }).success).toBe(false)
  })

  it('la base rechaza una lectura de un departamento inexistente', async () => {
    await laBaseLoRechazaPor(
      () => prisma.lectura.create({ data: { mes: EN_CURSO, dptoId: '999', valor: '100' } }),
      'lectura_dptoId_fkey',
    )
  })
})

describe('un crédito sin departamento', () => {
  it('lo rechaza el esquema', () => {
    expect(
      zGuardarGastos.safeParse({ extras: [{ tipo: 'credito', monto: 50 }] }).success,
    ).toBe(false)
  })

  it('la base lo rechaza con su CHECK', async () => {
    await laBaseLoRechazaPor(
      () =>
        prisma.gastoExtra.create({
          data: { mes: EN_CURSO, tipo: 'credito', concepto: 'x', monto: '50', dptoId: null },
        }),
      'credito_exige_dpto',
    )
  })

  it('un gasto CON departamento también se rechaza: lo pagan los siete', async () => {
    await laBaseLoRechazaPor(
      () =>
        prisma.gastoExtra.create({
          data: { mes: EN_CURSO, tipo: 'gasto', concepto: 'x', monto: '50', dptoId: '401' },
        }),
      'gasto_no_lleva_dpto',
    )
  })
})

/**
 * Un gasto fijo no se puede escribir sobre un mes **ya publicado**.
 *
 * El servicio comprobaba que un cambio no reescribiera los meses *anteriores* a
 * `vigenteDesde`, y no comprobaba el propio `vigenteDesde`. Medido contra la
 * API: con junio publicado, un PUT sobre junio subió la cuota del 101 de
 * S/ 373.82 a S/ 1,355.25, el vecino veía la nueva, y el aviso que salía decía
 * «los meses ya cerrados no cambian».
 *
 * El caso real son dos aparatos: el cierre abierto en el paso 4 del móvil,
 * publicado desde la laptop, y un toque más en el móvil sobre la pestaña vieja.
 */
describe('editar un gasto fijo de un mes ya publicado', () => {
  it('se rechaza con 409, y la cuota del mes no se mueve', async () => {
    const antes = await resultadoDeMes(PUBLICADO)
    const cuotaAntes = antes.valido ? antes.cuotas['101'].total : null

    const error = await falla(() =>
      guardarGastosFijos({
        cambios: [{ concepto: 'Guardianía · Jorge', monto: 9999 }],
        vigenteDesde: PUBLICADO,
      }),
    )
    expect(error.estado).toBe(409)

    const despues = await resultadoDeMes(PUBLICADO)
    expect(despues.valido && despues.cuotas['101'].total).toBe(cuotaAntes)
  })

  it('y sobre el mes en curso sí se puede: es lo que hace el paso 4', async () => {
    const r = await guardarGastosFijos(
      { cambios: [{ concepto: 'Insumos limpieza', monto: 45 }], vigenteDesde: EN_CURSO },
      true,
    )
    expect(r.cambiados).toHaveLength(1)
  })
})

describe('publicar un mes que ya está publicado', () => {
  it('falla limpiamente con 409', async () => {
    const error = await falla(() =>
      publicarMes(PUBLICADO, { notaQuePaso: 'x', notaQueCambio: 'x', notaQuePendiente: 'x' }),
    )
    expect(error.estado).toBe(409)
    expect(error.message).toContain('ya estaba publicado')
  })

  it('y no deja el mes tocado', async () => {
    const cierre = await prisma.cierre.findUnique({ where: { mes: PUBLICADO } })
    expect(cierre?.publicado).toBe(true)
    expect(cierre?.publicadoPor).toBe('semilla')
  })
})

describe('escribir en un mes ya publicado', () => {
  it('se rechaza: para eso está corregir, que avisa a los siete', async () => {
    const error = await falla(() => guardarLecturas(PUBLICADO, { lecturas: { '101': 181 } }))
    expect(error.estado).toBe(409)
    expect(error.message).toContain('corregirlo')
  })
})

describe('el PIN', () => {
  it('rechaza cualquier cosa que no sean cuatro dígitos', () => {
    for (const malo of ['', '1', '12345', 'abcd', '20 26', '²⁰²⁶']) {
      expect(zValidarPin.safeParse({ pin: malo }).success, malo).toBe(false)
    }
  })

  it('el correcto entra', async () => {
    const { cookie } = await validarPin('2026', '10.0.0.1')
    expect(cookie).toMatch(/^\d+\./)
  })

  it('veinte intentos incorrectos seguidos: el noveno ya está bloqueado', async () => {
    const ip = '10.0.0.99'
    const estados: number[] = []
    for (let i = 0; i < 20; i++) {
      const error = await falla(() => validarPin('0000', ip))
      estados.push(error.estado)
    }
    // Los ocho primeros son 401 (PIN incorrecto); a partir de ahí, 429.
    expect(estados.slice(0, 8).every((e) => e === 401)).toBe(true)
    expect(estados.slice(8).every((e) => e === 429)).toBe(true)
  })

  it('el PIN correcto tampoco entra si esa IP ya está bloqueada', async () => {
    const error = await falla(() => validarPin('2026', '10.0.0.99'))
    expect(error.estado).toBe(429)
  })

  it('otra IP no queda bloqueada por culpa de la primera', async () => {
    const { cookie } = await validarPin('2026', '10.0.0.2')
    expect(cookie).toBeTruthy()
  })

  /**
   * **El límite por IP no basta: la IP viene de una cabecera que se falsea.**
   *
   * Lo encontró la auditoría final ejecutando contra la app construida. La IP
   * sale de `x-forwarded-for`, que controla quien pide, así que rotándola en
   * cada intento el tope por IP no se toca nunca y los diez mil PINes vuelven a
   * estar al alcance. La defensa es el tope **global**: 40 fallos por ventana
   * sumando todas las IP.
   *
   * Este test simula el ataque llamando a `validarPin` con una IP distinta cada
   * vez. Sin el tope global, ninguna llamada se bloquea. Con él, la número 41 sí.
   *
   * Limpia `intento_pin` al entrar y al salir: el tope global lee TODAS las
   * filas de la ventana, así que un test que no aísle su cuenta contamina a los
   * demás de este fichero.
   */
  it('el tope global frena la fuerza bruta con IP rotada', async () => {
    await prisma.intentoPin.deleteMany()
    const estados: number[] = []
    for (let i = 0; i < 41; i++) {
      const error = await falla(() => validarPin('0000', `203.0.${Math.floor(i / 256)}.${i % 256}`))
      estados.push(error.estado)
    }
    // Los 40 primeros son 401 (PIN incorrecto, IP nueva cada vez); el 41 ya es 429.
    expect(estados.slice(0, 40).every((e) => e === 401)).toBe(true)
    expect(estados[40]).toBe(429)
    // Y el PIN correcto, desde una IP limpia, tampoco entra bajo el bloqueo global.
    const correcto = await falla(() => validarPin('2026', '198.51.100.7'))
    expect(correcto.estado).toBe(429)
    await prisma.intentoPin.deleteMany()
  })

  /**
   * **La cookie de sesión no se firma con el PIN.**
   *
   * Lo estuvo, y era un agujero: el PIN tiene cuatro dígitos, diez mil
   * posibilidades. Con una cookie válida en la mano —del historial del
   * navegador, de un registro, de un aparato prestado— se calculan las diez mil
   * firmas y se ve cuál coincide. Milisegundos en un portátil, y el límite de
   * ocho intentos por IP no protege porque el ataque no toca el servidor.
   *
   * Este test hace exactamente ese ataque: prueba los diez mil PINs contra la
   * cookie. Si alguno la reproduce, la firma vuelve a salir del PIN.
   */
  it('una cookie robada no revela el PIN: los diez mil no la reproducen', async () => {
    const { cookie } = await validarPin('2026', '10.0.0.3')
    const [carga, firma] = [cookie.slice(0, cookie.lastIndexOf('.')), cookie.slice(cookie.lastIndexOf('.') + 1)]

    let acertados = 0
    for (let n = 0; n < 10_000; n++) {
      const candidato = String(n).padStart(4, '0')
      const prueba = createHmac('sha256', candidato).update(carga).digest('base64url')
      if (prueba === firma) acertados++
    }
    expect(acertados, 'ningún PIN de cuatro dígitos puede reproducir la firma').toBe(0)
  })

  /**
   * **La firma no sale del PIN por ninguna derivación obvia.**
   *
   * El test de arriba prueba fuerza bruta de cuatro dígitos, y la auditoría
   * final señaló que no puede fallar: `claveDeFirma` rechaza cualquier clave de
   * menos de 32 caracteres, así que la firma nunca ES el PIN crudo y el barrido
   * está condenado a dar 0. No atrapa la regresión que importa: que alguien
   * derive la clave del PIN para llegar a los 32 caracteres (`PIN.repeat(8)`,
   * `PIN + relleno`…). Esto la atrapa afirmando la propiedad directamente: la
   * firma real no coincide con la de ninguna derivación del PIN.
   */
  it('la firma no coincide con ninguna clave derivada del PIN', async () => {
    const pin = process.env.ADMIN_PIN!
    const { cookie } = await validarPin('2026', '10.0.0.31')
    const corte = cookie.lastIndexOf('.')
    const [carga, firma] = [cookie.slice(0, corte), cookie.slice(corte + 1)]

    const derivaciones = [
      pin,
      pin.repeat(8), // 32 caracteres a partir de un PIN de 4
      pin.repeat(Math.ceil(32 / pin.length)),
      pin.padEnd(32, '0'),
      pin.padStart(32, '0'),
      `sb_${pin}`,
    ]
    for (const clave of derivaciones) {
      const prueba = createHmac('sha256', clave).update(carga).digest('base64url')
      expect(prueba, `la firma sale de una derivación del PIN: ${clave.slice(0, 8)}…`).not.toBe(firma)
    }
  })

  it('y la cookie sigue siendo válida, claro', async () => {
    const { cookie } = await validarPin('2026', '10.0.0.4')
    expect(sesionValida(cookie)).toBe(true)
    expect(sesionValida(`${cookie}x`), 'una firma alterada no vale').toBe(false)
    expect(sesionValida(undefined)).toBe(false)
  })

  it('una cookie caducada no vale, aunque la firma sea buena', () => {
    // Se firma un instante del pasado con la clave de verdad.
    const pasado = String(Date.now() - 1000)
    const firma = createHmac('sha256', process.env.ADMIN_SECRETO!).update(pasado).digest('base64url')
    expect(sesionValida(`${pasado}.${firma}`)).toBe(false)
  })
})

describe('confirmar un pago', () => {
  it('un pago ya confirmado no se confirma dos veces', async () => {
    const error = await falla(() => confirmarPago({ mes: PUBLICADO, dpto: '101' }))
    expect(error.estado).toBe(409)
  })

  it('un departamento inexistente da 404, no 500', async () => {
    const error = await falla(() =>
      confirmarPago({ mes: PUBLICADO, dpto: '999' as never }),
    )
    expect(error.estado).toBe(404)
  })
})

describe('avisar un pago', () => {
  it('sobre un pago ya confirmado, se rechaza', async () => {
    const error = await falla(() => avisarPago({ mes: PUBLICADO, dpto: '101' }))
    expect(error.estado).toBe(409)
  })
})

describe('inyección y cuerpos absurdos', () => {
  it("'; DROP TABLE recibo; -- no rompe nada", async () => {
    const veneno = "'; DROP TABLE recibo; --"
    expect(zMes.safeParse(veneno).success).toBe(false)
    // Y si llegara como concepto de un gasto, se guarda como texto y ya.
    await guardarGastos(EN_CURSO, { extras: [{ tipo: 'gasto', concepto: veneno, monto: 1 }] })
    const guardado = await prisma.gastoExtra.findFirst({ where: { mes: EN_CURSO } })
    expect(guardado?.concepto).toBe(veneno)
    const tablas = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `select count(*)::bigint as count from information_schema.tables where table_schema = 'public'`,
    )
    expect(Number(tablas[0]!.count)).toBeGreaterThan(10)
    await guardarGastos(EN_CURSO, { extras: [] })
  })

  it('<script> se guarda como texto, no se interpreta', async () => {
    const veneno = '<script>alert(1)</script>'
    await guardarGastos(EN_CURSO, { extras: [{ tipo: 'gasto', concepto: veneno, monto: 1 }] })
    const guardado = await prisma.gastoExtra.findFirst({ where: { mes: EN_CURSO } })
    expect(guardado?.concepto).toBe(veneno)
    await guardarGastos(EN_CURSO, { extras: [] })
  })

  it('un texto de 10 MB lo corta el esquema', () => {
    const enorme = 'x'.repeat(10 * 1024 * 1024)
    expect(zPublicar.safeParse({ notaQuePaso: enorme, notaQueCambio: '', notaQuePendiente: '' }).success).toBe(false)
    expect(zCorregir.safeParse({ motivo: enorme }).success).toBe(false)
  })

  it('una lista de mil gastos la corta el esquema', () => {
    const muchos = Array.from({ length: 1000 }, () => ({ tipo: 'gasto' as const, concepto: 'x', monto: 1 }))
    expect(zGuardarGastos.safeParse({ extras: muchos }).success).toBe(false)
  })

  it('un monto como cadena se rechaza, no se convierte en silencio', () => {
    // Convertir "1200" en 1200 automáticamente es cómo un gasto acabó
    // desapareciendo del total. Si llega una cadena, la arregla el cliente.
    expect(zGuardarGastos.safeParse({ extras: [{ tipo: 'gasto', concepto: 'x', monto: '1200' }] }).success).toBe(false)
    expect(zGuardarRecibo.safeParse({ aguaMonto: '325' }).success).toBe(false)
  })

  it('NaN e Infinity se rechazan', () => {
    for (const toxico of [NaN, Infinity, -Infinity]) {
      expect(zGuardarRecibo.safeParse({ aguaMonto: toxico }).success, String(toxico)).toBe(false)
      expect(zGuardarLecturas.safeParse({ lecturas: { '101': toxico } }).success, String(toxico)).toBe(false)
    }
  })

  it('un monto con tres decimales se rechaza: el dinero va en céntimos', () => {
    expect(zGuardarRecibo.safeParse({ aguaMonto: 325.123, version: 0 }).success).toBe(false)
    expect(zGuardarRecibo.safeParse({ aguaMonto: 325.12, version: 0 }).success).toBe(true)
  })

  it('los m³ del recibo tienen que venir en entero, como en el papel', () => {
    expect(zGuardarRecibo.safeParse({ aguaM3: 78.5, version: 0 }).success).toBe(false)
    expect(zGuardarRecibo.safeParse({ aguaM3: 78, version: 0 }).success).toBe(true)
  })

  /**
   * La versión del bloqueo optimista es **obligatoria** en la petición.
   *
   * Era opcional, y `tomarVersion` no comprueba nada cuando le llega
   * `undefined`: cualquier cliente que omitiera el campo se saltaba el bloqueo
   * entero y pisaba lo que estuviera escribiendo la otra pestaña, sin ruido.
   */
  it('una escritura del cierre sin versión se rechaza en la puerta', () => {
    expect(zGuardarRecibo.safeParse({ aguaM3: 78 }).success).toBe(false)
    expect(zGuardarLecturas.safeParse({ lecturas: { '101': 186.461 } }).success).toBe(false)
    expect(zGuardarLecturas.safeParse({ lecturas: { '101': 186.461 }, version: 0 }).success).toBe(true)
  })

  it('confirmar un pago con una fecha inventada se rechaza', () => {
    expect(zConfirmarPago.safeParse({ mes: '2026-07', dpto: '401', fecha: 'ayer' }).success).toBe(false)
  })
})
