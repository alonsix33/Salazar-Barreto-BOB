#!/usr/bin/env node
/**
 * Ningún secreto en el JavaScript que descarga el navegador. Fase 7, punto 3
 * del verificador: *«Grepea el bundle del cliente buscando `ADMIN_PIN`,
 * `DATABASE_URL`, `DEEPSEEK_API_KEY`. Cero resultados. Si aparece uno, es un
 * incidente de seguridad.»*
 *
 * Se busca **dos cosas distintas**, y las dos importan:
 *
 *  1. **El nombre de la variable.** Que aparezca `ADMIN_PIN` en el bundle
 *     significa que algo del cliente intenta leerla: aunque Next la sustituya
 *     por `undefined`, el intento es un error de arquitectura que hay que ver.
 *  2. **El valor.** Es lo que de verdad se filtra. Un `NEXT_PUBLIC_ADMIN_PIN`
 *     mal puesto no deja el nombre en el bundle: deja el **PIN**. Buscar solo el
 *     nombre no lo encontraría, que es justo el modo de fallo que este chequeo
 *     tiene que cubrir.
 *
 *   node scripts/verificar-secretos.mjs
 *
 * Necesita `.next/` construido. Sale con 1 si encuentra algo.
 */
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const ESTATICO = path.join(RAIZ, '.next/static')
/**
 * `public/` **también** es JavaScript que descarga el navegador.
 *
 * Ahí vive `sw.js`, que se registra en cada visita. La auditoría final lo
 * encontró: el chequeo solo miraba `.next/static`, así que un secreto escrito en
 * `public/` —o en el service worker— pasaba con el chequeo diciendo «limpio».
 * Se comprobó dejando el `ADMIN_SECRETO` entero en un `public/*.js`: verde.
 */
const PUBLICO = path.join(RAIZ, 'public')

/**
 * Carga `.env` si existe. **Sin esto el chequeo mentía.**
 *
 * `node` no lee `.env`: lo lee Next. Corriendo el script a mano, todas las
 * variables valían `undefined`, la búsqueda por valor se saltaba entera, y el
 * script imprimía «✓ ningún secreto» con el PIN escrito en el bundle. Se
 * comprobó inyectando la fuga: el bundle contenía `"data-pin":"2026"` y el
 * chequeo salía en verde.
 *
 * En integración continua las variables vienen del entorno y esto no hace nada.
 */
function cargarEnv() {
  const fichero = path.join(RAIZ, '.env')
  if (!fs.existsSync(fichero)) return
  for (const linea of fs.readFileSync(fichero, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const [, nombre, crudo] = m
    if (process.env[nombre] !== undefined) continue // el entorno manda
    process.env[nombre] = crudo.trim().replace(/^["']|["']$/g, '')
  }
}
cargarEnv()

/** Las variables que no pueden salir del servidor, ni por nombre ni por valor. */
const SECRETAS = [
  'ADMIN_PIN',
  'ADMIN_SECRETO',
  'DATABASE_URL',
  'DIRECT_URL',
  'DEEPSEEK_API_KEY',
  'PERMITIR_RESEMBRADO',
  // La clave privada de VAPID firma los push desde el servidor. La pública sí
  // va al navegador (`NEXT_PUBLIC_…`) y no es secreta; la privada, jamás.
  'VAPID_PRIVATE_KEY',
]

/** Valores demasiado cortos o comunes para buscarlos sin ahogarse en ruido. */
const MINIMO_VALOR = 6

if (!fs.existsSync(ESTATICO)) {
  console.error('No hay .next/static. Construye primero: npm run build')
  process.exit(2)
}

function ficheros(dir) {
  const salida = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, e.name)
    if (e.isDirectory()) salida.push(...ficheros(completo))
    else if (/\.(js|mjs|css|map|json)$/.test(e.name)) salida.push(completo)
  }
  return salida
}

const lista = [...ficheros(ESTATICO), ...(fs.existsSync(PUBLICO) ? ficheros(PUBLICO) : [])]
if (lista.length === 0) {
  console.error('.next/static existe pero está vacío. El chequeo no ha mirado nada.')
  process.exit(2)
}

/**
 * **Un chequeo que no ha mirado nada no puede decir que está limpio.**
 *
 * Si no hay ni un valor que buscar, lo único que se comprueba son los nombres, y
 * eso deja pasar la fuga más peligrosa —el valor sin el nombre—. Se dice y se
 * sale con 2, que es "el chequeo está roto", no "hay una fuga".
 */
const conValor = SECRETAS.filter((n) => (process.env[n] ?? '').length >= MINIMO_VALOR)
if (conValor.length === 0) {
  console.error(
    'verificar-secretos: no hay ningún valor en el entorno que buscar, así que solo\n' +
      'se comprobarían los nombres. Carga las variables (.env o el entorno) y repite.',
  )
  process.exit(2)
}

const hallazgos = []
for (const fichero of lista) {
  const contenido = fs.readFileSync(fichero, 'utf8')
  const rel = path.relative(RAIZ, fichero)
  for (const nombre of SECRETAS) {
    if (contenido.includes(nombre)) {
      hallazgos.push({ fichero: rel, que: `el nombre "${nombre}"` })
    }
    const valor = process.env[nombre]
    if (valor && valor.length >= MINIMO_VALOR && contenido.includes(valor)) {
      hallazgos.push({ fichero: rel, que: `el VALOR de ${nombre}` })
    }
  }
}

/**
 * El PIN aparte, porque es corto.
 *
 * Cuatro dígitos aparecen por casualidad en cualquier bundle —un número de
 * versión, un desplazamiento, un color—. Buscarlo tal cual daría falsos
 * positivos constantes y acabaría con alguien apagando el chequeo. Se busca en
 * la forma en que Next lo dejaría si alguien lo expusiera: dentro de un objeto
 * de entorno o asignado a algo que se llame como él.
 */
const pin = process.env.ADMIN_PIN
if (pin) {
  /**
   * Se busca el PIN **entrecomillado y cerca de la palabra "pin"**.
   *
   * La primera versión usaba expresiones que exigían la forma
   * `pin: "2026"`, y el minificador de Next no deja esa forma: escribe
   * `"data-pin":"2026"`, con la comilla en medio. Se comprobó inyectando la fuga
   * de verdad —el PIN en un atributo de un componente de cliente— y el chequeo
   * **encontró el nombre y se le escapó el valor**, que es lo que de verdad
   * importa: un `NEXT_PUBLIC_ADMIN_PIN` mal puesto deja el PIN sin dejar el
   * nombre.
   *
   * Ahora se localiza cada aparición del valor entre comillas y se mira una
   * ventana de 80 caracteres alrededor. Cuatro dígitos sueltos aparecen por
   * casualidad en cualquier bundle; cuatro dígitos entrecomillados a menos de
   * ochenta caracteres de la palabra "pin", no.
   */
  const VENTANA = 80
  for (const fichero of lista) {
    const contenido = fs.readFileSync(fichero, 'utf8')
    for (const comilla of ['"', "'", '`']) {
      const aguja = `${comilla}${pin}${comilla}`
      let desde = 0
      for (;;) {
        const i = contenido.indexOf(aguja, desde)
        if (i === -1) break
        desde = i + aguja.length
        const alrededor = contenido.slice(
          Math.max(0, i - VENTANA),
          Math.min(contenido.length, i + aguja.length + VENTANA),
        )
        if (/pin/i.test(alrededor)) {
          hallazgos.push({
            fichero: path.relative(RAIZ, fichero),
            que: `el PIN de administración (${aguja} junto a "pin")`,
          })
          break
        }
      }
    }
  }
}

if (hallazgos.length > 0) {
  console.error(`\n✗ INCIDENTE DE SEGURIDAD · ${hallazgos.length} hallazgo(s) en el bundle del cliente:\n`)
  for (const h of hallazgos) console.error(`  ${h.fichero}\n      ${h.que}`)
  console.error('\nEsto lo descarga el navegador de cualquiera. No se despliega.\n')
  process.exit(1)
}

const kb = Math.round(lista.reduce((s, f) => s + fs.statSync(f).size, 0) / 1024)
console.log(
  `✓ ningún secreto en el bundle del cliente · ${lista.length} ficheros, ${kb} KB` +
    `\n  por nombre: ${SECRETAS.join(', ')}` +
    `\n  por valor:  ${conValor.join(', ')}${process.env.ADMIN_PIN ? ', ADMIN_PIN (junto a "pin")' : ''}`,
)
