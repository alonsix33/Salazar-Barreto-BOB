#!/usr/bin/env node
/**
 * Lighthouse móvil sobre la app construida. Fase 6, punto 6 del verificador.
 *
 * Levanta el servidor de producción, corre Lighthouse sobre las pantallas de
 * vecino y **exige** dos de los tres mínimos del enunciado: rendimiento ≥ 90 y
 * accesibilidad ≥ 95.
 *
 * **El tercero, "PWA instalable", Lighthouse ya no lo mide.** La categoría `pwa`
 * y la auditoría `installable-manifest` se retiraron en la versión 12: aquí
 * quedan cinco categorías —performance, accessibility, best-practices, seo,
 * agentic-browsing— y ninguna auditoría que hable de manifiesto o de service
 * worker. Comprobado listándolas.
 *
 * Esto importa porque la primera versión de este script preguntaba
 * `audits['installable-manifest']?.score === 1`, que sobre una auditoría que no
 * existe es `undefined === 1`: **siempre falso**. Un chequeo que no puede pasar
 * es tan inútil como uno que no puede fallar, y encima tapa el hueco real. Lo
 * instalable se verifica en `tests/e2e/pwa.spec.ts`, con las mismas condiciones
 * que Chrome exige: manifiesto con nombre corto, `start_url`, `display:
 * standalone`, iconos PNG de verdad de 192 y 512, y un service worker con
 * manejador de `fetch`.
 *
 * La accesibilidad da 95 y no 100 por una sola cosa: `color-contrast`, que es la
 * paleta de `02` §1 —diseño validado— y está medida combinación a combinación en
 * `lib/__tests__/contraste.test.ts`. Sin eso serían 100.
 *
 *   node scripts/lighthouse.mjs
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import lighthouse from 'lighthouse'

const PUERTO = Number(process.env.PUERTO_LH ?? 3300)
const BASE = `http://localhost:${PUERTO}`
const PANTALLAS = ['/', '/mes', '/mi-departamento', '/historial', '/avisos']

const MINIMOS = { performance: 90, accessibility: 95 }

async function esperar(url, intentos = 90) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      // Todavía no está arriba.
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`El servidor no levantó en ${intentos} s`)
}

const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  stdio: 'pipe',
  env: process.env,
})
process.on('exit', () => servidor.kill())

let navegador
let salida = 0
try {
  await esperar(BASE)
  navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--remote-debugging-port=9222'],
  })

  const filas = []
  for (const ruta of PANTALLAS) {
    const resultado = await lighthouse(
      `${BASE}${ruta}`,
      { port: 9222, output: 'json', logLevel: 'error' },
      undefined,
    )
    const c = resultado.lhr.categories
    const fila = {
      ruta,
      rendimiento: Math.round(c.performance.score * 100),
      accesibilidad: Math.round(c.accessibility.score * 100),
      buenasPracticas: Math.round(c['best-practices'].score * 100),
      // Lo que la accesibilidad deja por el camino, con nombre. Sin esto, un 95
      // no dice si falta una cosa conocida o diez desconocidas.
      pendientes: c.accessibility.auditRefs
        .map((ref) => resultado.lhr.audits[ref.id])
        .filter((a) => a && a.score !== null && a.score < 1)
        .map((a) => a.id),
    }
    filas.push(fila)
    const marca = (v, min) => (v >= min ? '✓' : '✗')
    console.log(
      `${ruta.padEnd(20)} rendimiento ${String(fila.rendimiento).padStart(3)} ${marca(fila.rendimiento, MINIMOS.performance)}` +
        `  accesibilidad ${String(fila.accesibilidad).padStart(3)} ${marca(fila.accesibilidad, MINIMOS.accessibility)}` +
        `  buenas prácticas ${String(fila.buenasPracticas).padStart(3)}` +
        (fila.pendientes.length ? `  · pendiente: ${fila.pendientes.join(', ')}` : ''),
    )
    if (fila.rendimiento < MINIMOS.performance) salida = 1
    if (fila.accesibilidad < MINIMOS.accessibility) salida = 1
    /**
     * Lo único que puede quedar pendiente es el contraste, y está declarado.
     * Si aparece otra cosa, es nueva y hay que mirarla.
     */
    const inesperadas = fila.pendientes.filter((id) => id !== 'color-contrast')
    if (inesperadas.length > 0) {
      console.error(`    ✗ auditorías de accesibilidad que no estaban declaradas: ${inesperadas.join(', ')}`)
      salida = 1
    }
  }

  if (filas.length !== PANTALLAS.length) {
    console.error('No se midieron todas las pantallas. El chequeo está roto.')
    salida = 2
  }
  console.log(
    salida === 0
      ? `\n✓ las ${filas.length} pantallas pasan: rendimiento ≥ ${MINIMOS.performance}, accesibilidad ≥ ${MINIMOS.accessibility}.` +
          `\n  Lo instalable no lo mide Lighthouse desde la v12: está en tests/e2e/pwa.spec.ts.` +
          `\n  El contraste no llega a 100 por la paleta de 02 §1: medido en lib/__tests__/contraste.test.ts.`
      : `\n✗ alguna pantalla no llega a los mínimos.`,
  )
} finally {
  await navegador?.close()
  servidor.kill()
}
process.exit(salida)
