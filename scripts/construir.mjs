#!/usr/bin/env node
/**
 * `npm run build`, con la **versión del despliegue** sellada dentro.
 *
 * Existe por un defecto del service worker: su `VERSION` estaba tecleada a mano
 * (`'v1'`) y nunca cambiaba. Consecuencias medidas:
 *
 *  - `public/sw.js` era **idéntico byte a byte** entre despliegues, así que el
 *    navegador nunca veía un service worker nuevo: `install` y `activate` no
 *    volvían a correr jamás después de la primera visita.
 *  - La limpieza de `activate` borra las cachés cuyo nombre no esté en la lista,
 *    y como el nombre nunca cambiaba, **no podía borrar nada**. Los chunks de
 *    cada despliegue se quedaban encima de los del anterior: medido, 14 ficheros
 *    tras el primero y 18 tras el segundo, sin que se fuera ninguno. Crece hasta
 *    que el navegador desaloja el almacenamiento **entero** del origen, incluida
 *    la copia sin conexión que es la razón de existir de todo esto.
 *
 * La versión sale de lo que haya: el commit en Vercel, el de git en local, o la
 * hora. Lo único que importa es que **cambie en cada despliegue**.
 */
import { execFileSync, spawnSync } from 'node:child_process'

function version() {
  if (process.env.NEXT_PUBLIC_BUILD_ID) return process.env.NEXT_PUBLIC_BUILD_ID
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    // Sin git —un tarball, un contenedor pelado—: la hora sirve igual.
    return String(Date.now())
  }
}

const sello = version()
console.log(`Sello de este build: ${sello}`)

for (const [orden, args] of [
  ['prisma', ['generate']],
  ['next', ['build']],
]) {
  const r = spawnSync('npx', [orden, ...args], {
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_BUILD_ID: sello },
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
