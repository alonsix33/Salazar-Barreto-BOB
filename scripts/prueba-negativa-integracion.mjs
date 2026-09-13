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
  /**
   * Los dos topes del PIN van **por separado**, y no es un capricho.
   *
   * Son dos protecciones distintas: la de por IP frena a quien insiste desde un
   * sitio, y la global frena a quien rota la cabecera `x-forwarded-for` para
   * presentar una IP nueva en cada intento. Esa segunda salió de un agujero
   * real que encontró la auditoría —con la IP fija el noveno intento daba 429;
   * rotándola, los diez mil PINes quedaban al alcance sin un solo 429—.
   *
   * Una sola inyección que tumbara la condición entera pasaría en cuanto
   * cualquiera de los dos tests diera rojo, y dejaría de comprobar que el otro
   * tope tiene quien lo vigile. Aquí estaba antes justamente eso, y encima
   * apuntando a una línea que ya no existe: al ganar el tope global la
   * condición cambió, la sustitución dejó de encontrar su objetivo, y el script
   * lo dio por «no aplicable» sin probar nada.
   */
  ['servicios/admin.ts', 'quitar el tope de intentos por IP',
    'if (fallidos >= MAX_INTENTOS || fallidosGlobal >= MAX_GLOBAL) {',
    'if (fallidosGlobal >= MAX_GLOBAL) {'],
  ['servicios/admin.ts', 'quitar el tope global, el que frena la IP rotada',
    'if (fallidos >= MAX_INTENTOS || fallidosGlobal >= MAX_GLOBAL) {',
    'if (fallidos >= MAX_INTENTOS) {'],
  /**
   * La foto del edificio (`datos/almanaque.ts`) es de dónde salen ahora los
   * números de todas las pantallas de vecino. Cambió la **lectura**, no el
   * motor, así que los cuatro defectos posibles son de lectura: la herencia del
   * lavado, su valor congelado, la vigencia de los gastos fijos y la conversión
   * desde `Decimal`. Los cuatro dan cuotas plausibles y equivocadas.
   */
  ['datos/almanaque.ts', 'que la foto pierda la herencia del lavado',
    "    const anterior = r.activaEn.find((a) => a.mes === mesAnterior(mes))\n    if (anterior) return anterior.activa ? r.m3 : 0",
    '    // defecto inyectado'],
  ['datos/almanaque.ts', 'que la foto ignore los m³ congelados al publicar',
    '      congelado === null || congelado === undefined ? r.m3 : congelado',
    '      r.m3'],
  ['datos/almanaque.ts', 'que la foto cobre gastos fijos que aún no estaban vigentes',
    '    for (const f of crudos.fijos) if (f.vigenteDesde <= mes) porConcepto.set(f.concepto, f)',
    '    for (const f of crudos.fijos) porConcepto.set(f.concepto, f)'],
  ['datos/almanaque.ts', 'que la foto guarde un Decimal donde va un número',
    '      aguaMonto: aNumeroObligatorio(r.aguaMonto),',
    '      aguaMonto: r.aguaMonto,'],
  /**
   * La invalidación de la caché. Si esto se cae, las pantallas enseñan números
   * viejos y **nada se pone rojo**: la app va rápida, los números son
   * plausibles, y son los de antes de la última corrección.
   *
   * Ojo con cómo se comprueba: el chequeo obvio —levantar la app, escribir y
   * mirar si la pantalla cambia— pasa igual con la invalidación arrancada,
   * porque en `next start` cualquier POST vacía la caché del proceso. Está
   * contado en la cabecera de `tests/integracion/invalidar-cache.test.ts`.
   */
  ['datos/prisma.ts', 'que una escritura deje de invalidar la caché',
    '          if (ESCRITURAS.has(operation)) seEscribio()',
    '          void operation'],
  ['datos/prisma.ts', 'que se caiga una operación de la lista de escrituras',
    "  'upsert',\n", ''],
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
/** Inyecciones que ya no encuentran su objetivo. Ver el bloque de abajo. */
let obsoletos = 0
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
if (obsoletos > 0) {
  console.error(`\n${obsoletos} inyección(es) obsoleta(s): apuntan a código que ya no existe.`)
  console.error('No faltan tests: lo que hay que actualizar es este script.')
}
if (sinDetectar > 0) {
  console.error(`\n${sinDetectar} defecto(s) que la suite NO atrapa. Faltan tests.`)
}
if (obsoletos > 0 || sinDetectar > 0) process.exit(1)
console.log(`\n✓ los ${DEFECTOS.length} defectos se detectan.`)
