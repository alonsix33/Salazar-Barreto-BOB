#!/usr/bin/env node
/**
 * Prueba negativa de los tests de integración.
 *
 * Inyecta defectos reales en la capa de servicios y comprueba que la suite de
 * integración se pone roja. Necesita `DATABASE_URL`.
 *
 *   DATABASE_URL=… node scripts/prueba-negativa-integracion.mjs
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')

const DEFECTOS = [
  ['servicios/auditoria.ts', 'avisar siempre, también en un mes en curso',
    "  const cierre = await tx.cierre.findUnique({ where: { mes }, select: { publicado: true } })\n  if (!cierre?.publicado) return false",
    '  // defecto inyectado'],
  ['servicios/cierre.ts', 'dejar de auditar las lecturas',
    "      await auditar(tx, {\n        usuario: ADMIN,\n        accion: anterior ? 'editar' : 'crear',\n        entidad: 'lectura',",
    "      await Promise.resolve({\n        usuario: ADMIN,\n        accion: anterior ? 'editar' : 'crear',\n        entidad: 'lectura',"],
  ['servicios/cierre.ts', 'dejar publicar un mes que no cuadra',
    '  if (!resultado.cuadra) {', '  if (false) {'],
  // Publicar volvió a ser leer-comparar-escribir: se quita `publicado: false`
  // del WHERE y la segunda publicación simultánea vuelve a colarse.
  ['servicios/cierre.ts', 'dejar publicar dos veces',
    '        publicado: false,\n        ...(datos.version === undefined ? {} : { version: datos.version }),',
    '        ...(datos.version === undefined ? {} : { version: datos.version }),'],
  // Los m³ del lavado vuelven a leerse del valor global: cambiar el consumo
  // reescribe las cuotas de los meses ya publicados.
  ['datos/mes.ts', 'que el lavado vuelva a reescribir el pasado',
    '  if (marcaDelMes) return marcaDelMes.activa ? vigente(marcaDelMes.m3) : 0',
    '  if (marcaDelMes) return marcaDelMes.activa ? aNumeroObligatorio(reasignacion.m3) : 0'],
  // Los gastos fijos vuelven a poder escribirse sobre un mes ya publicado.
  ['servicios/gastosFijos.ts', 'editar un gasto fijo de un mes publicado',
    '    await exigirNoPublicado(tx, datos.vigenteDesde)',
    '    if (false) await exigirNoPublicado(tx, datos.vigenteDesde)'],
  ['servicios/cierre.ts', 'permitir escribir en un mes publicado',
    '    await exigirNoPublicado(tx, mes)\n    const version = await tomarVersion(tx, mes, datos.version)\n\n    for (const [dpto, valor] of Object.entries(datos.lecturas))',
    '    const version = await tomarVersion(tx, mes, datos.version)\n\n    for (const [dpto, valor] of Object.entries(datos.lecturas))'],
  ['servicios/bloqueo.ts', 'volver al bloqueo optimista con carrera',
    '  const actualizado = await tx.cierre.updateMany({\n    where: { mes, version },\n    data: { version: { increment: 1 } },\n  })\n  if (actualizado.count === 0) {',
    '  if (version !== cierre.version) {'],
  ['servicios/admin.ts', 'quitar el límite de intentos del PIN',
    '  if (fallidos >= MAX_INTENTOS) {', '  if (false) {'],
  ['servicios/pagos.ts', 'contar un aviso de pago como confirmado',
    "      update: { estado: 'aviso', operacion: datos.operacion ?? null, texto: datos.texto ?? null },",
    "      update: { estado: 'confirmado', operacion: datos.operacion ?? null, texto: datos.texto ?? null },"],
]

function correr() {
  try {
    execFileSync('npx', ['vitest', 'run', '--config', 'vitest.integracion.config.ts', '--silent'], {
      cwd: RAIZ, encoding: 'utf8', stdio: 'pipe', env: process.env,
    })
    return { verde: true, salida: '' }
  } catch (e) {
    return { verde: false, salida: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

const base = correr()
if (!base.verde) {
  console.error('La suite de integración ya está roja antes de inyectar nada.')
  console.error(base.salida.slice(-2000))
  process.exit(2)
}
console.log('Punto de partida: suite de integración en verde.\n')

let sinDetectar = 0
/**
 * Igual que en `prueba-negativa.mjs`: este script escribe defectos en el árbol
 * de trabajo real, y si lo matan a mitad se quedan puestos.
 */
const pendientes = new Map()

function restaurarTodo() {
  for (const [ruta, contenido] of pendientes) {
    try {
      fs.writeFileSync(ruta, contenido)
    } catch {
      // Nada más que hacer.
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

for (const [archivo, descripcion, buscar, reemplazar] of DEFECTOS) {
  const ruta = path.join(RAIZ, 'lib', archivo)
  const original = fs.readFileSync(ruta, 'utf8')
  if (!original.includes(buscar)) {
    console.log(`  ⚠ NO APLICABLE  ${descripcion} · actualiza este script`)
    sinDetectar++
    continue
  }
  pendientes.set(ruta, original)
  fs.writeFileSync(ruta, original.replace(buscar, reemplazar))
  const { verde, salida } = correr()
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

const final = correr()
console.log(`\nRestaurado: la suite vuelve a estar ${final.verde ? 'en verde' : 'ROTA'}.`)
if (!final.verde) process.exit(2)
if (sinDetectar > 0) {
  console.error(`\n${sinDetectar} defecto(s) que la suite no atrapa. Faltan tests.`)
  process.exit(1)
}
console.log(`\n✓ los ${DEFECTOS.length} defectos se detectan.`)
