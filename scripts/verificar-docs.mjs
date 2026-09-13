#!/usr/bin/env node
/**
 * ¿Dicen la verdad el README, `CLAUDE.md` y el handoff?
 *
 * Un enlace roto o un comando que no existe es peor que no tener el documento:
 * manda a alguien a un sitio que no está, y de paso le quita la confianza en
 * todo lo demás que dice. Aquí se comprueba ejecutando.
 *
 * ## Lo que cubre, y por qué así
 *
 *  1. **Enlaces markdown** a ficheros del repositorio, con su ancla.
 *  2. **Rutas del repositorio en cualquier sitio del texto**, incluidos los
 *     diagramas dentro de bloques de código. La primera versión de este script
 *     solo miraba las rutas entre comillas invertidas, y el README apenas las
 *     escribe así: las pone en un árbol y en tablas. O sea que decía cubrir las
 *     rutas y no cubría casi ninguna. Se vio en su prueba negativa, al inyectar
 *     una ruta falsa que el script no detectó.
 *  3. **Los ficheros sueltos de las tablas**, resueltos contra la carpeta que
 *     titula su sección: en «### `lib/calculo/`», la fila `saldo.ts` tiene que
 *     existir en `lib/calculo/saldo.ts`.
 *  4. **`npm run …`** contra los scripts de `package.json`.
 *
 * Su prueba negativa está abajo, en `--prueba-negativa`.
 */

import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const DOCS = ['README.md', 'CLAUDE.md', 'docs/HANDOFF.md']
const CARPETAS = 'lib|app|components|scripts|tests|prisma|docs|public|mockup'

const scripts = Object.keys(
  JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts,
)

/** Un marcador de posición no es una ruta: `docs/verificacion-<n>.md`. */
const esMarcador = (s) => /[*…<>]/.test(s)

/** Los anclas de un markdown, como los genera GitHub. */
function anclas(texto) {
  return new Set(
    [...texto.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, t]) =>
      t.trim().toLowerCase()
        .replace(/[`*_]/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        // Un espacio, un guion. GitHub **no** colapsa los espacios seguidos:
        // «Claves · de dónde» deja dos guiones porque el punto desaparece.
        .replace(/ /g, '-'),
    ),
  )
}

export function revisar() {
  const problemas = []
  const mal = (doc, que) => problemas.push(`${doc}: ${que}`)

  for (const doc of DOCS) {
    const texto = fs.readFileSync(path.join(RAIZ, doc), 'utf8')
    const base = path.dirname(path.join(RAIZ, doc))

    // 1 · enlaces markdown
    for (const [, , destino] of texto.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(destino)) continue
      const [ruta, ancla] = destino.split('#')
      const absoluta = ruta ? path.resolve(base, ruta) : path.join(RAIZ, doc)
      if (!fs.existsSync(absoluta)) { mal(doc, `enlace a un fichero que no existe → ${destino}`); continue }
      if (ancla && !anclas(fs.readFileSync(absoluta, 'utf8')).has(ancla)) {
        mal(doc, `ancla que no existe → ${destino}`)
      }
    }

    // 2 · rutas del repositorio, estén donde estén
    const rutas = new RegExp(`(?:^|[\\s\`(|])((?:${CARPETAS})/[\\w./[\\]()<>*…-]*)`, 'g')
    for (const [, cruda] of texto.matchAll(rutas)) {
      const ruta = cruda.replace(/[.,`)]+$/, '')
      if (esMarcador(ruta)) continue
      // Una carpeta citada como carpeta (`lib/datos/`) también tiene que existir.
      if (!fs.existsSync(path.join(RAIZ, ruta))) mal(doc, `ruta que no existe → ${ruta}`)
    }

    // 3 · las tablas de ficheros, contra la carpeta de su sección
    let carpeta = null
    for (const linea of texto.split('\n')) {
      const titulo = linea.match(new RegExp(`^#{2,4}\\s+\`((?:${CARPETAS})/[\\w/]*)\``))
      if (titulo) { carpeta = titulo[1]; continue }
      if (/^#{2,4}\s/.test(linea)) { carpeta = null; continue }
      if (!carpeta) continue
      const fila = linea.match(/^\|\s*`([\w.-]+\.(?:ts|tsx|mjs|css|prisma))`\s*\|/)
      if (fila && !fs.existsSync(path.join(RAIZ, carpeta, fila[1]))) {
        mal(doc, `la tabla de ${carpeta} cita ${fila[1]}, que no está ahí`)
      }
    }

    // 4 · comandos
    for (const [, cmd] of texto.matchAll(/npm run ([a-z0-9:-]+)/g)) {
      if (!scripts.includes(cmd)) mal(doc, `npm run ${cmd} no está en package.json`)
    }
  }
  return problemas
}

/**
 * La prueba negativa: inyecta defectos reales en el README y exige que se
 * detecten. Una inyección que no encuentra su objetivo se reporta **aparte**:
 * no es que falte cobertura, es que este script se quedó viejo, y confundir las
 * dos cosas cuesta una tarde.
 */
const DEFECTOS = [
  ['una ruta inventada dentro del árbol del repositorio',
    'lib/calculo/     El motor.', 'lib/inventado/   El motor.'],
  ['una ruta inventada dentro de un diagrama',
    '├─ lib/datos/almanaque.ts', '├─ lib/datos/inventado.ts'],
  ['un fichero de una tabla que no está en su carpeta',
    '| `saldo.ts` |', '| `no-existe.ts` |'],
  ['un enlace a un documento que no existe',
    '[`docs/HANDOFF.md`](docs/HANDOFF.md)', '[`docs/HANDOFF.md`](docs/NO-ESTA.md)'],
  ['un ancla que no existe en un documento que sí',
    '(docs/DESPLIEGUE.md#lo-que-hay-que-hacer-cada-mes)', '(docs/DESPLIEGUE.md#ancla-inventada)'],
  ['un comando que no está en package.json',
    '`npm run verify`', '`npm run verifyy`'],
]

function pruebaNegativa() {
  const readme = path.join(RAIZ, 'README.md')
  const original = fs.readFileSync(readme, 'utf8')
  const restaurar = () => fs.writeFileSync(readme, original)
  process.on('exit', restaurar)
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(senal, () => { restaurar(); process.exit(130) })
  }

  if (revisar().length > 0) {
    console.error('Los documentos ya están mal antes de inyectar nada.')
    process.exit(2)
  }
  console.log('Punto de partida: los tres documentos en verde.\n')

  let sinDetectar = 0
  let obsoletos = 0
  for (const [descripcion, buscar, reemplazar] of DEFECTOS) {
    if (!original.includes(buscar)) {
      console.log(`  ⚠ OBSOLETA  ${descripcion}`)
      console.log(`      «${buscar}» ya no está en el README; actualiza ESTE SCRIPT, no el documento`)
      obsoletos++
      continue
    }
    fs.writeFileSync(readme, original.replace(buscar, reemplazar))
    const encontrados = revisar()
    fs.writeFileSync(readme, original)
    if (encontrados.length === 0) {
      console.log(`  ✗ NO SE DETECTA  ${descripcion}`)
      sinDetectar++
    } else {
      console.log(`  ✓ detectado  ${descripcion}`)
    }
  }

  if (obsoletos > 0) console.error(`\n${obsoletos} inyección(es) obsoleta(s): apuntan a texto que ya no está.`)
  if (sinDetectar > 0) console.error(`\n${sinDetectar} defecto(s) que este script NO atrapa.`)
  if (obsoletos > 0 || sinDetectar > 0) process.exit(1)
  console.log(`\n✓ los ${DEFECTOS.length} defectos se detectan.`)
}

if (process.argv.includes('--prueba-negativa')) {
  pruebaNegativa()
} else {
  const problemas = revisar()
  for (const p of problemas) console.log(`  ✗ ${p}`)
  console.log(problemas.length === 0
    ? `✓ ${DOCS.length} documentos · todos los enlaces, rutas, ficheros y comandos existen`
    : `\n${problemas.length} problema(s).`)
  process.exit(problemas.length ? 1 : 0)
}
