import { expect, test, type Page } from '@playwright/test'

/**
 * Responsive de verdad. Fase 4, punto 2 del verificador.
 *
 * Siete anchos y dos alturas, las seis pantallas de vecino. **En ningún caso
 * puede haber desborde horizontal ni recorte.** Un desborde de dos píxeles en un
 * teléfono de 320px es una barra de scroll horizontal en la pantalla de alguien
 * que solo quería ver su cuota.
 */

const ANCHOS = [320, 360, 390, 430, 768, 1024, 1440]
const ALTURAS = [844, 560]

/**
 * Cada pantalla, con **un texto que solo aparece si de verdad se cargó**.
 *
 * El centinela existe por un fallo concreto: `/admin` estaba en esta lista y los
 * 14 tests de "Administración" medían la **pantalla del PIN**, no el panel. La
 * sesión de administración no viaja en el `storageState` de la configuración,
 * así que el servidor devolvía `<PedirPin/>` y el chequeo daba verde midiendo un
 * teclado de cuatro dígitos. El panel y sus cuatro hojas —las pantallas más
 * densas de la app— no tenían ni una medida de desborde a ningún ancho.
 *
 * Ahora, si la pantalla que se mide no es la que se dice medir, el test falla.
 */
const PANTALLAS = [
  { ruta: '/', nombre: 'Inicio', centinela: /Tu cuota de/, admin: false },
  { ruta: '/mes', nombre: 'El mes', centinela: /Costó mantener el edificio/, admin: false },
  {
    ruta: '/mi-departamento',
    nombre: 'Mi departamento',
    centinela: /Tu historia en el edificio/,
    admin: false,
  },
  { ruta: '/historial', nombre: 'Historial', centinela: /Mes a mes/, admin: false },
  { ruta: '/avisos', nombre: 'Avisos', centinela: /Todo lo que se movió/, admin: false },
  {
    ruta: '/admin',
    nombre: 'Administración',
    centinela: /Cerrar el mes siguiente/,
    admin: true,
  },
]

/**
 * Qué se desborda, si algo se desborda. Devuelve los culpables, no un booleano.
 *
 * **No cuenta lo que está dentro de un contenedor que scrollea a lo ancho a
 * propósito**, como el carrusel de meses de P2: ahí que un mes quede fuera de la
 * vista es la función, no un defecto. Lo que sí es un defecto es que algo empuje
 * al marco entero, y eso lo cubre la comprobación de `scrollWidth`.
 *
 * La primera versión de este chequeo no hacía esa distinción y marcaba el
 * carrusel en nueve tamaños. Un chequeo que grita donde no hay nada es un
 * chequeo que alguien acaba desactivando.
 */
async function culpablesDeDesborde(pagina: Page): Promise<{ culpables: string[]; examinados: number }> {
  return pagina.evaluate(() => {
    const marco = document.querySelector('.marco-app')
    if (!marco) return { culpables: ['no se encontró .marco-app'], examinados: 0 }
    const limite = marco.getBoundingClientRect()

    /**
     * Solo se perdona lo que está dentro de un contenedor que **declara** que
     * scrollea a lo ancho, con `data-scroll-x`. Hoy hay uno: el carrusel de
     * meses de P2, donde que un mes quede fuera de la vista es la función.
     *
     * Las dos versiones anteriores de este chequeo miraban el CSS calculado y
     * las dos se desactivaban solas:
     *
     *  1. Mirando `overflow-x`: si `overflow-y` es `auto`, el CSS calcula
     *     `overflow-x: auto` aunque nadie lo escriba, así que TODO lo que
     *     estuviera dentro de una pantalla con scroll vertical quedaba exento.
     *  2. Añadiendo "y que scrollee de verdad": un desborde real convierte al
     *     padre en scroller horizontal, con lo que el desborde se excusaba a sí
     *     mismo.
     *
     * Se comprobó las dos veces metiendo una cifra de 600px en un marco de
     * 390px: el chequeo seguía en verde. Con `data-scroll-x` no hay forma de que
     * un defecto se cuele por la puerta de atrás.
     */
    const dentroDeUnScrollHorizontal = (el: HTMLElement): boolean =>
      el.closest('[data-scroll-x]') !== null

    const culpables: string[] = []
    let examinados = 0
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.marco-app *'))) {
      const caja = el.getBoundingClientRect()
      if (caja.width === 0) continue
      examinados++
      if (dentroDeUnScrollHorizontal(el)) continue
      // Un píxel de antialiasing no es un desborde.
      if (caja.right > limite.right + 1 || caja.left < limite.left - 1) {
        const clase = el.className.toString().split(' ').slice(0, 3).join('.')
        culpables.push(`${el.tagName.toLowerCase()}.${clase} (${Math.round(caja.left)}→${Math.round(caja.right)})`)
      }
      if (culpables.length >= 5) break
    }
    // Cuántos miró de verdad, para no pasar sobre cero: si el selector dejara de
    // encontrar nada —una clase renombrada, un marco que no montó— el barrido
    // daría «sin culpables» sin haber mirado un solo elemento.
    return { culpables, examinados }
  })
}

test.describe('sin desbordes horizontales', () => {
  for (const alto of ALTURAS) {
    for (const ancho of ANCHOS) {
      for (const { ruta, nombre, centinela, admin } of PANTALLAS) {
        test(`${nombre} a ${ancho}×${alto}`, async ({ page }) => {
          await page.setViewportSize({ width: ancho, height: alto })
          if (admin) {
            const r = await page.request.post('/api/admin/pin', {
              data: { pin: process.env.ADMIN_PIN ?? '2026' },
            })
            expect(r.ok(), 'sin PIN se mediría la pantalla del PIN, no el panel').toBeTruthy()
          }
          await page.goto(ruta)
          await page.waitForLoadState('domcontentloaded')

          // La pantalla que se mide es la que se dice medir, no otra.
          await expect(
            page.getByText(centinela).first(),
            `${nombre} no se cargó: se estaría midiendo otra pantalla`,
          ).toBeVisible()

          const marco = page.locator('.marco-app')
          await expect(marco).toBeVisible()

          const medidas = await marco.evaluate((el) => ({
            scroll: el.scrollWidth,
            cliente: el.clientWidth,
          }))
          expect(medidas.scroll, `${nombre} se desborda a ${ancho}px`).toBeLessThanOrEqual(medidas.cliente)

          const { culpables, examinados } = await culpablesDeDesborde(page)
          expect(
            examinados,
            `el barrido no miró ni un elemento en ${nombre} a ${ancho}px: no probó nada`,
          ).toBeGreaterThan(20)
          expect(culpables, `elementos fuera del marco en ${nombre} a ${ancho}px`).toEqual([])

          // Y el documento tampoco: una barra horizontal en el body es igual de mala.
          const cuerpo = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            cliente: document.documentElement.clientWidth,
          }))
          expect(cuerpo.scroll, `el documento se desborda en ${nombre} a ${ancho}px`).toBeLessThanOrEqual(
            cuerpo.cliente + 1,
          )
        })
      }
    }
  }
})

test.describe('el marco solo existe en escritorio', () => {
  test('en un teléfono la app ocupa la pantalla, sin marco ni sombra', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const estilo = await page.locator('.marco-app').evaluate((el) => {
      const s = getComputedStyle(el)
      return { radio: s.borderTopLeftRadius, sombra: s.boxShadow, ancho: el.clientWidth }
    })
    expect(estilo.radio).toBe('0px')
    expect(estilo.sombra).toBe('none')
    expect(estilo.ancho).toBe(390)
  })

  test('en escritorio sí hay marco de 390 centrado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const estilo = await page.locator('.marco-app').evaluate((el) => {
      const s = getComputedStyle(el)
      return { radio: s.borderTopLeftRadius, sombra: s.boxShadow, ancho: el.clientWidth }
    })
    expect(estilo.radio).toBe('38px')
    expect(estilo.sombra).not.toBe('none')
    expect(estilo.ancho).toBeLessThanOrEqual(392)
  })

  test('no hay layout de escritorio de dos columnas', async ({ page }) => {
    // Decisión tomada: son siete vecinos consultando desde el celular. Una
    // versión ancha sería una pantalla que nadie usa y hay que mantener igual.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const ancho = await page.locator('.marco-app').evaluate((el) => el.clientWidth)
    expect(ancho).toBeLessThan(500)
  })
})

/**
 * Las hojas del panel de administración, que no medía nadie.
 *
 * Son las pantallas más densas de la app —tablas de siete filas con nombre,
 * cuota y lectura de tres decimales en 320 px— y hasta aquí no tenían ni una
 * medida de desborde, porque los 14 tests de "Administración" estaban midiendo
 * la pantalla del PIN.
 *
 * Se miden en el ancho más estrecho y en el más ancho: si algo se desborda, es
 * en 320.
 */
test.describe('las hojas de administración tampoco se desbordan', () => {
  const HOJAS = [
    { boton: /Cerrar el mes siguiente|Empezar |Seguir con /, titulo: /Vamos a cerrar/ },
    { boton: /lavado de vehículo/, titulo: /Cargos y créditos activos/ },
    { boton: /Corregir/, titulo: /Corregir /, },
    { boton: /Exportar el año en Excel/, titulo: /Exportar el año/ },
  ]

  for (const ancho of [320, 430]) {
    for (const { boton, titulo } of HOJAS) {
      test(`hoja ${String(titulo)} a ${ancho}px`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: 844 })
        const r = await page.request.post('/api/admin/pin', {
          data: { pin: process.env.ADMIN_PIN ?? '2026' },
        })
        expect(r.ok()).toBeTruthy()
        await page.goto('/admin')
        await page.getByRole('button', { name: boton }).first().click()

        const hoja = page.getByRole('dialog')
        await expect(hoja).toBeVisible()
        await expect(hoja.getByText(titulo).first()).toBeVisible()

        const medidas = await hoja.evaluate((el) => ({
          scroll: el.scrollWidth,
          cliente: el.clientWidth,
        }))
        expect(medidas.scroll, `la hoja se desborda a ${ancho}px`).toBeLessThanOrEqual(
          medidas.cliente,
        )

        const { culpables, examinados } = await culpablesDeDesborde(page)
        expect(examinados, `el barrido no miró nada con la hoja a ${ancho}px`).toBeGreaterThan(5)
        expect(culpables, `elementos fuera del marco con la hoja abierta a ${ancho}px`).toEqual([])
      })
    }
  }
})
