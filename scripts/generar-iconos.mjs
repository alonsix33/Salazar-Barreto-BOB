/**
 * Genera los iconos de la PWA a partir de un SVG, con los colores del tema.
 *
 * Los PNG están versionados —el despliegue no puede depender de que alguien
 * ejecute esto—, pero se generan aquí y no a mano para que **el color salga del
 * token** y no de un valor tecleado en un editor de imágenes. `lib/tema.ts` es
 * la única puerta por la que un color sale de `globals.css`, y su test compara
 * los dos.
 *
 * La marca es la fachada del edificio: siete ventanas, una por departamento.
 * No es el avatar de Bob a propósito: Bob es el asistente, no la aplicación.
 *
 *   node scripts/generar-iconos.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.resolve(import.meta.dirname, '..')
const DESTINO = path.join(RAIZ, 'public/iconos')

/** Se leen de `lib/tema.ts` en crudo: este script no pasa por TypeScript. */
const tema = fs.readFileSync(path.join(RAIZ, 'lib/tema.ts'), 'utf8')
const leer = (nombre) => {
  const m = tema.match(new RegExp(`export const ${nombre} = '(#[0-9A-Fa-f]{6})'`))
  if (!m) throw new Error(`No se encontró ${nombre} en lib/tema.ts`)
  return m[1]
}
const CREMA = leer('COLOR_TEMA')
const NOCHE = leer('COLOR_NOCHE')

/**
 * La fachada del edificio, en una cuadrícula de 512.
 *
 * Cinco pisos y **las siete ventanas donde de verdad están los departamentos**:
 * 101 en el primero, 201 y 202 en el segundo, 301 en el tercero, 401 en el
 * cuarto, 501 y 502 en el quinto. No es decoración: es el edificio.
 *
 * `margen` deja la zona segura de los iconos recortables: Android puede recortar
 * hasta un círculo del 80 % del lienzo, así que con margen alto el dibujo vive
 * dentro del centro y lo de fuera es fondo liso.
 */
function fachada({ fondo, tinta, margen }) {
  const lado = 512
  const caja = lado * (1 - margen * 2)
  const x0 = lado * margen
  const y0 = lado * margen

  // El cuerpo: un bloque más alto que ancho, con las esquinas de arriba redondeadas.
  const anchoCuerpo = caja * 0.7
  const cx = x0 + (caja - anchoCuerpo) / 2
  const cuerpo = `<rect x="${cx.toFixed(1)}" y="${y0.toFixed(1)}" width="${anchoCuerpo.toFixed(1)}" height="${caja.toFixed(1)}" rx="${(caja * 0.08).toFixed(1)}"/>`

  // Los cinco pisos, de arriba abajo, con los departamentos que tiene cada uno:
  // quinto 501 y 502, cuarto 401, tercero 301, segundo 201 y 202, primero 101.
  // Las columnas son fijas: un piso de un solo departamento no centra su ventana,
  // la deja en su columna. Centradas se encadenaban en vertical y el dibujo
  // dejaba de leerse como una fachada.
  const pisos = [2, 1, 1, 2, 1]
  // La altura de la ventana sale del piso, no al revés: al fijarla por el ancho
  // salía más alta que el piso y las de una misma columna se tocaban, formando
  // una barra vertical en vez de cinco ventanas.
  const alturaPiso = caja / 6.4
  const h = alturaPiso * 0.62
  const w = h * 0.85
  // Las dos columnas, centradas en el 30 % y el 70 % del ancho de la fachada.
  const columnas = [cx + anchoCuerpo * 0.3 - w / 2, cx + anchoCuerpo * 0.7 - w / 2]
  const ventanas = []
  pisos.forEach((cuantos, i) => {
    const y = y0 + alturaPiso * (0.5 + i)
    for (let n = 0; n < cuantos; n++) {
      const x = columnas[n]
      ventanas.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w * 0.28).toFixed(1)}"/>`)
    }
  })

  // La puerta, centrada y **a ras del suelo**: se dibuja más alta que el hueco
  // que ocupa y el redondeo de abajo cae fuera del cuerpo, así que no flota.
  const anchoPuerta = w * 1.25
  const altoPuerta = alturaPiso * 1.0
  const puerta = `<rect x="${(cx + (anchoCuerpo - anchoPuerta) / 2).toFixed(1)}" y="${(y0 + caja - altoPuerta).toFixed(1)}" width="${anchoPuerta.toFixed(1)}" height="${(altoPuerta + anchoPuerta).toFixed(1)}" rx="${(anchoPuerta * 0.45).toFixed(1)}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" fill="${fondo}"/>
  <g fill="${tinta}">${cuerpo}</g>
  <g fill="${fondo}">${ventanas.join('')}${puerta}</g>
</svg>`
}

const NORMAL = fachada({ fondo: NOCHE, tinta: CREMA, margen: 0.16 })
const RECORTABLE = fachada({ fondo: NOCHE, tinta: CREMA, margen: 0.26 })

const PIEZAS = [
  { nombre: 'icono-192.png', tamano: 192, svg: NORMAL },
  { nombre: 'icono-512.png', tamano: 512, svg: NORMAL },
  { nombre: 'icono-recortable-192.png', tamano: 192, svg: RECORTABLE },
  { nombre: 'icono-recortable-512.png', tamano: 512, svg: RECORTABLE },
  // iOS no entiende `maskable` y recorta él mismo la esquina: se le da el
  // cuadrado completo, sin transparencia, que es lo que espera.
  { nombre: 'apple-touch-icon.png', tamano: 180, svg: NORMAL },
  { nombre: 'icono-32.png', tamano: 32, svg: NORMAL },
]

fs.mkdirSync(DESTINO, { recursive: true })
for (const p of PIEZAS) {
  await sharp(Buffer.from(p.svg)).resize(p.tamano, p.tamano).png().toFile(path.join(DESTINO, p.nombre))
  console.log(`✓ ${p.nombre} · ${p.tamano}×${p.tamano}`)
}
fs.writeFileSync(path.join(DESTINO, 'icono.svg'), NORMAL)
console.log('✓ icono.svg')
