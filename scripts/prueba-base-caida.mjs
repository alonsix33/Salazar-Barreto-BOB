#!/usr/bin/env node
/**
 * ¿Qué ve un vecino si la base de datos no responde? Fase 7, punto 4 del
 * verificador: *«rompe la conexión a la base a propósito. ¿La app da un error
 * claro o una pantalla en blanco?»*
 *
 * Levanta la app construida apuntando a un puerto donde no hay nadie, la abre en
 * un navegador de verdad, y comprueba tres cosas:
 *
 *  1. Que se ve un mensaje **en castellano y para una persona**, no
 *     «Application error: a server-side exception has occurred».
 *  2. Que dice **que no se ha perdido nada**, que es lo primero que piensa quien
 *     acaba de teclear siete lecturas.
 *  3. Que **no se filtra nada técnico**: ni la cadena de conexión, ni el nombre
 *     de una tabla, ni una traza.
 *
 * No va en la suite normal porque necesita una base rota a propósito.
 *
 *   npm run build && node scripts/prueba-base-caida.mjs
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PUERTO = Number(process.env.PUERTO_CAIDA ?? 3410)
const BASE = `http://localhost:${PUERTO}`
/** Un puerto donde no hay ninguna base escuchando. */
const MUERTA = 'postgresql://postgres@127.0.0.1:59999/no-existe'

const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL: MUERTA, DIRECT_URL: MUERTA },
})
process.on('exit', () => servidor.kill())

async function esperar() {
  for (let i = 0; i < 60; i++) {
    try {
      // Cualquier respuesta vale, incluido el 500: significa que ya escucha.
      await fetch(BASE)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('El servidor no levantó')
}

let salida = 0
let navegador
try {
  await esperar()
  navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })
  const ctx = await navegador.newContext()
  await ctx.addCookies([{ name: 'sb_dpto', value: '401', domain: 'localhost', path: '/' }])
  const pagina = await ctx.newPage()
  await pagina.goto(BASE, { waitUntil: 'networkidle' })
  const texto = await pagina.locator('body').innerText()

  const comprobar = (descripcion, condicion) => {
    console.log(`  ${condicion ? '✓' : '✗'} ${descripcion}`)
    if (!condicion) salida = 1
  }

  console.log('Con la base caída, el vecino ve:\n')
  console.log(`  «${texto.replace(/\n+/g, ' · ')}»\n`)

  comprobar('un mensaje en castellano, no el de Next', texto.includes('Algo no está respondiendo'))
  comprobar('dice que no se ha perdido nada', /no se ha perdido nada/i.test(texto))
  comprobar('ofrece volver a intentarlo', /volver a intentarlo/i.test(texto))
  comprobar('no está en blanco', texto.trim().length > 40)
  comprobar('no filtra nada técnico', !/postgres|prisma|59999|stack|Error:/i.test(texto))
} finally {
  await navegador?.close()
  servidor.kill()
}

console.log(salida === 0 ? '\n✓ la base caída da un error claro.' : '\n✗ revisa el mensaje.')
process.exit(salida)
