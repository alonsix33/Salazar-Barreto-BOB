#!/usr/bin/env node
/**
 * Prueba negativa de la suite del motor.
 *
 * Un chequeo que nunca se vio fallar no es un chequeo: es una decoración. Este
 * script inyecta, uno por uno, defectos reales en `lib/calculo/` y comprueba
 * que la suite **se pone roja**. Después restaura el archivo y comprueba que
 * vuelve al verde.
 *
 *   node scripts/prueba-negativa.mjs
 *
 * Los doce defectos no son inventados: son los que una auditoría adversaria
 * encontró que la suite **no** detectaba, más los tres clásicos del motor.
 * Si mañana alguien borra un test, este script lo dice.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')

/** `[archivo, descripción, buscar, reemplazar]` */
const DEFECTOS = [
  ['calcularMes.ts', 'no exigir las siete lecturas del mes',
    'if (faltanLecturas.length > 0) {', 'if (false) {'],
  ['calcularMes.ts', 'ignorar los extras guardados y mirar solo el borrador',
    'ov.extras ?? entradas.extras', 'ov.extras ?? []'],
  ['calcularMes.ts', 'ignorar las lecturas que se están tecleando',
    'DPTOS.map((d) => [d.id, (ov.lecturas?.[d.id] ?? entradas.lecturas[d.id])!]),',
    'DPTOS.map((d) => [d.id, entradas.lecturas[d.id]!]),'],
  ['calcularMes.ts', 'ignorar el descuento del borrador',
    'descuento: pisa(ov.recibo?.descuento, base?.descuento, null),',
    'descuento: base?.descuento ?? null,'],
  ['calcularMes.ts', 'simplificar el redondeo del mantenimiento a round2',
    'const mant = Math.round(baseMant * d.flat) / 100',
    'const mant = round2((baseMant * d.flat) / 100)'],
  ['calcularMes.ts', 'redondear el precio del m³',
    'const precioM3 = facturaAgua / rec.aguaM3', 'const precioM3 = round2(facturaAgua / rec.aguaM3)'],
  ['calcularMes.ts', 'sumar el lavado en vez de reasignarlo',
    'const comunReal = round2(brutoComun - lavado)', 'const comunReal = round2(brutoComun)'],
  ['calcularMes.ts', 'sacar el tercer cuadre de la condición de publicar',
    'cuadra: cuadraAgua && cuadraMes && sanidad.cuadra,', 'cuadra: cuadraAgua && cuadraMes,'],
  ['calcularMes.ts', 'dejar que un lavadoM3 nulo desactive el lavado',
    'const lavM3 = ov.lavadoM3 ?? entradas.lavadoM3 ?? LAVADO.m3',
    'const lavM3 = ov.lavadoM3 ?? entradas.lavadoM3'],
  ['sanidad.ts', 'volver al `|| 0` que concatena cadenas al sumar los gastos',
    'for (const l of lineas) if (esFinito(l.monto)) total += l.monto',
    'for (const l of lineas) total += (l.monto || 0)'],
  ['calcularMes.ts', 'tratar un override undefined como "por confirmar"',
    "    const escrito = ov.fijos?.[concepto]\n    if (escrito !== undefined) return escrito",
    "    if (ov.fijos && Object.prototype.hasOwnProperty.call(ov.fijos, concepto)) return ov.fijos[concepto] ?? null"],
  ['constantes.ts', 'aflojar la tolerancia del cuadre del agua cien veces',
    'export const TOLERANCIA_AGUA = 0.03', 'export const TOLERANCIA_AGUA = 3'],
]

function correrSuite() {
  try {
    execFileSync('npx', ['vitest', 'run', '--silent'], { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' })
    return { verde: true, salida: '' }
  } catch (e) {
    return { verde: false, salida: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

const base = correrSuite()
if (!base.verde) {
  console.error('La suite ya está roja antes de inyectar nada. Arregla eso primero.')
  process.exit(2)
}
console.log('Punto de partida: suite en verde.\n')

/**
 * Lo que hay que devolver a su sitio pase lo que pase.
 *
 * Este script escribe defectos en el árbol de trabajo **real**. Si lo matan a
 * mitad —Ctrl-C, un `timeout`, un OOM— el defecto se queda puesto: comprobado
 * con `timeout -s INT 12`, el cuarto defecto seguía en `calcularMes.ts` al
 * volver. La suite queda en rojo, así que grita; pero limpiarlo a ciegas con un
 * `git checkout lib/` se lleva por delante el trabajo sin commitear que haya
 * encima.
 */
const pendientes = new Map()

function restaurarTodo() {
  for (const [ruta, contenido] of pendientes) {
    try {
      fs.writeFileSync(ruta, contenido)
    } catch {
      // Si ni siquiera se puede escribir, no hay nada más que hacer aquí.
    }
  }
  pendientes.clear()
}

process.on('exit', restaurarTodo)
for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(senal, () => {
    restaurarTodo()
    console.error(`\nInterrumpido (${senal}). El árbol quedó como estaba.`)
    process.exit(130)
  })
}
process.on('uncaughtException', (e) => {
  restaurarTodo()
  console.error('\nSe rompió el script. El árbol quedó como estaba.\n', e)
  process.exit(2)
})

let sinDetectar = 0
for (const [archivo, descripcion, buscar, reemplazar] of DEFECTOS) {
  const ruta = path.join(RAIZ, 'lib/calculo', archivo)
  const original = fs.readFileSync(ruta, 'utf8')
  if (!original.includes(buscar)) {
    console.log(`  ⚠ NO APLICABLE  ${descripcion}`)
    console.log(`      el código a sustituir ya no existe en ${archivo}; actualiza este script`)
    sinDetectar++
    continue
  }
  pendientes.set(ruta, original)
  fs.writeFileSync(ruta, original.replace(buscar, reemplazar))
  const { verde, salida } = correrSuite()
  fs.writeFileSync(ruta, original)
  pendientes.delete(ruta)
  if (verde) {
    console.log(`  ✗ NO SE DETECTA  ${descripcion}`)
    sinDetectar++
  } else {
    const n = salida.match(/Tests\s+(\d+) failed/)?.[1] ?? '?'
    console.log(`  ✓ rojo (${String(n).padStart(3)} tests)  ${descripcion}`)
  }
}

const final = correrSuite()
console.log(`\nRestaurado: la suite vuelve a estar ${final.verde ? 'en verde' : 'ROTA'}.`)
if (!final.verde) {
  console.error('El script dejó el árbol sucio.')
  process.exit(2)
}
if (sinDetectar > 0) {
  console.error(`\n${sinDetectar} defecto(s) que la suite no atrapa. Faltan tests.`)
  process.exit(1)
}
console.log(`\n✓ los ${DEFECTOS.length} defectos se detectan.`)
