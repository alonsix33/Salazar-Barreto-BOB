#!/usr/bin/env node
/**
 * Imprime el TEXTO de una pantalla de la app, sin el HTML.
 *
 *   node scripts/ver-pantalla.mjs /mes/2026-06 [401] [ancho]
 *
 * Existe para poder comprobar lo que se ve sin volcar cien kilobytes de marcado
 * cada vez. Usa el Chromium del entorno.
 */
import { chromium } from '@playwright/test'

const ruta = process.argv[2] ?? '/'
const dpto = process.argv[3] ?? '401'
const ancho = Number(process.argv[4] ?? 390)
const base = process.env.BASE_URL ?? 'http://localhost:3100'

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 } })
await contexto.addCookies([{ name: 'sb_dpto', value: dpto, url: base }])
const pagina = await contexto.newPage()
const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))
pagina.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text())
})
const respuesta = await pagina.goto(base + ruta, { waitUntil: "domcontentloaded" })
console.log(`── ${ruta} · dpto ${dpto} · ${ancho}px · HTTP ${respuesta?.status()}`)
console.log(await pagina.evaluate(() => document.body.innerText))
const desborde = await pagina.evaluate(() => {
  const app = document.querySelector('.marco-app')
  return app ? { scroll: app.scrollWidth, cliente: app.clientWidth } : null
})
console.log(`── desborde horizontal: ${desborde ? `${desborde.scroll} vs ${desborde.cliente}` : 'sin marco'}`)
if (errores.length) console.log('── errores:\n' + errores.slice(0, 5).join('\n'))
await navegador.close()
