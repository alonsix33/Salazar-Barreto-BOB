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
  ['calculo/calcularMes.ts', 'no exigir las siete lecturas del mes',
    'if (faltanLecturas.length > 0) {', 'if (false) {'],
  ['calculo/calcularMes.ts', 'ignorar los extras guardados y mirar solo el borrador',
    'ov.extras ?? entradas.extras', 'ov.extras ?? []'],
  ['calculo/calcularMes.ts', 'ignorar las lecturas que se están tecleando',
    'DPTOS.map((d) => [d.id, (ov.lecturas?.[d.id] ?? entradas.lecturas[d.id])!]),',
    'DPTOS.map((d) => [d.id, entradas.lecturas[d.id]!]),'],
  ['calculo/calcularMes.ts', 'ignorar el descuento del borrador',
    'descuento: pisa(ov.recibo?.descuento, base?.descuento, null),',
    'descuento: base?.descuento ?? null,'],
  ['calculo/calcularMes.ts', 'simplificar el redondeo del mantenimiento a round2',
    'const mant = Math.round(baseMant * d.flat) / 100',
    'const mant = round2((baseMant * d.flat) / 100)'],
  ['calculo/calcularMes.ts', 'redondear el precio del m³',
    'const precioM3 = facturaAgua / rec.aguaM3', 'const precioM3 = round2(facturaAgua / rec.aguaM3)'],
  ['calculo/calcularMes.ts', 'sumar el lavado en vez de reasignarlo',
    'const comunReal = ajustado ? 0 : round2(brutoComun - lavado)',
    'const comunReal = ajustado ? 0 : round2(brutoComun)'],
  ['calculo/calcularMes.ts', 'sacar un cuadre de la condición de publicar',
    'cuadra: cuadraAgua && cuadraM3 && cuadraMes && sanidad.cuadra,',
    'cuadra: cuadraAgua && cuadraM3 && cuadraMes,'],
  ['calculo/calcularMes.ts', 'dejar que un lavadoM3 nulo desactive el lavado',
    'const lavM3 = ov.lavadoM3 ?? entradas.lavadoM3 ?? LAVADO.m3',
    'const lavM3 = ov.lavadoM3 ?? entradas.lavadoM3'],
  ['calculo/sanidad.ts', 'volver al `|| 0` que concatena cadenas al sumar los gastos',
    'for (const l of lineas) if (esFinito(l.monto)) total += l.monto',
    'for (const l of lineas) total += (l.monto || 0)'],
  ['calculo/calcularMes.ts', 'tratar un override undefined como "por confirmar"',
    "    const escrito = ov.fijos?.[concepto]\n    if (escrito !== undefined) return escrito",
    "    if (ov.fijos && Object.prototype.hasOwnProperty.call(ov.fijos, concepto)) return ov.fijos[concepto] ?? null"],
  ['calculo/constantes.ts', 'aflojar la tolerancia del cuadre del agua cien veces',
    'export const TOLERANCIA_AGUA = 0.03', 'export const TOLERANCIA_AGUA = 3'],
  /**
   * Las reglas de lectura (`datos/filas.ts`). No son del motor, pero deciden
   * **qué entra** en él, y equivocarse ahí da cuotas plausibles y falsas.
   *
   * Están aquí porque la regla es pura: no hace falta base de datos para
   * probarla. Y hacen falta porque vivieron un rato duplicadas —una copia en la
   * lectura por transacción y otra en la foto del edificio—, que es el fallo que
   * este proyecto ya había pagado una vez.
   */
  ['datos/filas.ts', 'perder la herencia del lavado del mes anterior',
    '  const anterior = r.activaEn.find((a) => a.mes === mesAnterior(mes))\n  if (anterior) return anterior.activa ? r.m3 : 0',
    '  // defecto inyectado'],
  ['datos/filas.ts', 'ignorar los m³ congelados al publicar · reescribe el pasado',
    '    congelado === null || congelado === undefined ? r.m3 : congelado',
    '    r.m3'],
  ['datos/filas.ts', 'cobrar el lavado en un mes con la casilla desmarcada',
    '  if (marcaDelMes) return marcaDelMes.activa ? vigente(marcaDelMes.m3) : 0',
    '  if (marcaDelMes) return vigente(marcaDelMes.m3)'],
  ['datos/filas.ts', 'cobrar gastos fijos que aún no estaban vigentes',
    '  for (const f of fijos) if (f.vigenteDesde <= mes) porConcepto.set(f.concepto, f)',
    '  for (const f of fijos) porConcepto.set(f.concepto, f)'],
  ['datos/filas.ts', 'quedarse con el monto viejo de un gasto fijo, no el vigente',
    '  const porConcepto = new Map<string, T>()\n  for (const f of fijos) if (f.vigenteDesde <= mes) porConcepto.set(f.concepto, f)',
    '  const porConcepto = new Map<string, T>()\n  for (const f of fijos) if (f.vigenteDesde <= mes && !porConcepto.has(f.concepto)) porConcepto.set(f.concepto, f)'],
  ['datos/filas.ts', 'repartir un gasto entre los siete ignorando a los participantes',
    '        participantes: e.participantes as DptoId[],', '        participantes: [] as DptoId[],'],
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
/** Inyecciones que ya no encuentran su objetivo. Ver el bloque de abajo. */
let obsoletos = 0
for (const [archivo, descripcion, buscar, reemplazar] of DEFECTOS) {
  // La ruta va relativa a `lib/`: casi todos los defectos son de `calculo/`,
  // pero las reglas de lectura viven en `datos/filas.ts` y también se inyectan.
  const ruta = path.join(RAIZ, 'lib', archivo)
  const original = fs.readFileSync(ruta, 'utf8')
  if (!original.includes(buscar)) {
    /**
     * El código a sustituir ya no existe: **el script se quedó viejo**.
     *
     * Se cuenta aparte de «no se detecta» porque son dos problemas distintos y
     * antes se reportaban con el mismo mensaje. «No se detecta» es que falta un
     * test; esto es que la inyección no llegó a probar nada, y arreglarlo es
     * actualizar esta línea, no escribir un test. Confundirlos cuesta una tarde.
     */
    console.log(`  ⚠ OBSOLETA  ${descripcion}`)
    console.log(`      el texto a sustituir ya no está en ${archivo}; actualiza ESTE SCRIPT, no los tests`)
    obsoletos++
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
if (obsoletos > 0) {
  console.error(`\n${obsoletos} inyección(es) obsoleta(s): apuntan a código que ya no existe.`)
  console.error('No faltan tests: lo que hay que actualizar es este script.')
}
if (sinDetectar > 0) {
  console.error(`\n${sinDetectar} defecto(s) que la suite NO atrapa. Faltan tests.`)
}
if (obsoletos > 0 || sinDetectar > 0) process.exit(1)
console.log(`\n✓ los ${DEFECTOS.length} defectos se detectan.`)
