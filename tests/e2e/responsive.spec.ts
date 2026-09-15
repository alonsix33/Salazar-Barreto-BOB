import { expect, test } from '@playwright/test'
import { culpablesDeDesborde } from './desborde'

/**
 * Responsive de verdad. Fase 4, punto 2 del verificador.
 *
 * Siete anchos y dos alturas, las seis pantallas de vecino. **En ningún caso
 * puede haber desborde horizontal ni recorte.** Un desborde de dos píxeles en un
 * teléfono de 320px es una barra de scroll horizontal en la pantalla de alguien
 * que solo quería ver su cuota.
 */

const ANCHOS = [320, 360, 390, 430, 768, 1024, 1440]
// 844/560: teléfono vertical/horizontal. 1133: iPad Mini vertical de verdad,
// el techo del rango que la app soporta de forma fluida (`--spacing-app-tablet`).
const ALTURAS = [844, 560, 1133]

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

/**
 * El marco fue una tarjeta de teléfono fija (390×844, con radio y sombra)
 * desde tablet para arriba. Se cambió a pedido explícito: la app tiene que
 * verse bien de un teléfono chico a un iPad Mini vertical con el ancho
 * fluido, sin saltar a una tarjeta flotante. Estos tests protegían la
 * tarjeta fija; ahora protegen lo contrario, a propósito.
 */
test.describe('el ancho es fluido, sin marco en ningún tamaño', () => {
  test('nunca hay radio ni sombra, ni en teléfono ni en tablet', async ({ page }) => {
    for (const [ancho, alto] of [
      [390, 844],
      [768, 1024],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width: ancho, height: alto })
      await page.goto('/')
      const estilo = await page.locator('.marco-app').evaluate((el) => {
        const s = getComputedStyle(el)
        return { radio: s.borderTopLeftRadius, sombra: s.boxShadow }
      })
      expect(estilo.radio, `${ancho}×${alto}`).toBe('0px')
      expect(estilo.sombra, `${ancho}×${alto}`).toBe('none')
    }
  })

  test('el ancho crece con la ventana hasta el techo de iPad Mini vertical, y se topa ahí', async ({ page }) => {
    // Por debajo del techo (768px): el marco ocupa la ventana entera.
    for (const ancho of [320, 390, 430, 768]) {
      await page.setViewportSize({ width: ancho, height: 1024 })
      await page.goto('/')
      const medido = await page.locator('.marco-app').evaluate((el) => el.clientWidth)
      expect(medido, `a ${ancho}px de ventana`).toBe(ancho)
    }

    // Por encima (una ventana de escritorio, fuera del rango que se diseñó):
    // se queda capado en el techo, centrado, en vez de seguir estirándose.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const conTecho = await page.locator('.marco-app').evaluate((el) => el.clientWidth)
    expect(conTecho).toBe(768)
  })

  test('no hay layout de escritorio de dos columnas', async ({ page }) => {
    // Decisión tomada: son siete vecinos consultando desde el celular o la
    // tablet, en vertical. Una versión ancha de verdad —dos columnas— sería
    // una pantalla que nadie usa y hay que mantener igual. El ancho fluido
    // hasta 768px no es eso: sigue siendo una sola columna, solo que no
    // recortada a 390px en una tablet.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const ancho = await page.locator('.marco-app').evaluate((el) => el.clientWidth)
    expect(ancho).toBeLessThanOrEqual(768)
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
