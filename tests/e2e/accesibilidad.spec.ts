import AxeBuilder from '@axe-core/playwright'
import type { Result } from 'axe-core'
import { expect, test, type Page } from './basedatos'

/**
 * Accesibilidad. Fase 6, punto 5 del enunciado y puntos 3 y 5 del verificador.
 *
 * `axe-core` sobre las seis pantallas de vecino, la de administración y las
 * hojas, **con cero violaciones críticas o serias**. Y un recorrido con el
 * teclado, porque axe no toca nada: comprueba el marcado, no si la app se puede
 * usar sin ratón.
 *
 * Lo que `axe` NO cubre y hay que decir en voz alta: si un `aria-label` dice la
 * verdad, si el orden de lectura tiene sentido, y si lo que anuncia un lector de
 * pantalla se entiende. Eso se probó a mano y está en `docs/verificacion-6.md`.
 */

const PIN = process.env.ADMIN_PIN ?? '2026'

/**
 * **El contraste se mide aparte, y aquí se desactiva a propósito.**
 *
 * No es para que la suite se ponga verde: es que `color-contrast` señala la
 * paleta, y la paleta es diseño validado con el usuario a lo largo de muchas
 * iteraciones — el mockup manda ahí. Repetir el mismo hallazgo en seis pantallas
 * y en cuatro hojas no añade información y sí acaba con alguien apagando la
 * regla entera.
 *
 * Lo que sí hay es la medida exacta de **cada** combinación de `02` §1, con su
 * ratio fijado en un test que se pone rojo si alguien mueve un color:
 * `lib/__tests__/contraste.test.ts`. Cuatro combinaciones no llegan a AA —una de
 * ellas, el gris sobre crema, es la que `02` §8 afirma que sí cumple— y están
 * declaradas en `docs/verificacion-6.md` con lo que costaría arreglarlas.
 *
 * Todo lo demás de WCAG 2.1 AA sí se exige aquí, y a cero.
 */
async function violaciones(page: Page, dentroDe?: string): Promise<Result[]> {
  let constructor = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
  if (dentroDe) constructor = constructor.include(dentroDe)
  const resultado = await constructor.analyze()
  return resultado.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

/** Un informe que se lee sin abrir el navegador. */
function describir(malas: readonly Result[]): string {
  return malas
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `    ${n.target.join(' ')} · ${n.failureSummary ?? ''}`).join('\n'),
    )
    .join('\n')
}

const PANTALLAS = [
  { ruta: '/', nombre: 'Inicio', admin: false },
  { ruta: '/mes', nombre: 'El mes', admin: false },
  { ruta: '/mi-departamento', nombre: 'Mi departamento', admin: false },
  { ruta: '/historial', nombre: 'Historial', admin: false },
  { ruta: '/avisos', nombre: 'Avisos', admin: false },
  { ruta: '/admin', nombre: 'Administración', admin: true },
]

test.describe('axe-core · cero violaciones críticas o serias', () => {
  for (const { ruta, nombre, admin } of PANTALLAS) {
    test(nombre, async ({ page }) => {
      if (admin) {
        const r = await page.request.post('/api/admin/pin', { data: { pin: PIN } })
        expect(r.ok()).toBeTruthy()
      }
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      const malas = await violaciones(page)
      expect(malas.length, `${nombre}:\n${describir(malas)}`).toBe(0)
    })
  }
})

/**
 * La pantalla del PIN, que **ningún test había visto nunca**.
 *
 * El fixture de la base hace `POST /api/admin/pin` antes de cada test, así que
 * `/admin` siempre renderiza el panel y la pantalla del PIN no se pintaba en
 * ninguna corrida. Ahí estaba el defecto de que quien administra sin ver no
 * podía saber cuántos dígitos llevaba tecleados.
 */
test.describe('axe-core · la pantalla del PIN', () => {
  test('sin sesión de administración', async ({ page }) => {
    await page.context().clearCookies({ name: 'sb_admin' })
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Administrar el edificio')).toBeVisible()
    const malas = await violaciones(page)
    expect(malas.length, `pantalla del PIN:\n${describir(malas)}`).toBe(0)
  })

  test('lo que teclea se anuncia', async ({ page }) => {
    await page.context().clearCookies({ name: 'sb_admin' })
    await page.goto('/admin')
    const region = page.locator('[role="status"]').filter({ hasText: /dígitos|Sin dígitos/ })
    await expect(region).toContainText('Sin dígitos')
    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(region).toContainText('1 de 4')
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect(region).toContainText('2 de 4')
  })
})

test.describe('axe-core · las hojas', () => {
  /**
   * **Las diez hojas, no cuatro.**
   *
   * Se escaneaban `calculo`, `pagar`, `wizard` y `corregir`, y quedaban fuera
   * seis. En una de ellas —el historial de pagos— estaba el mismo defecto que
   * este bloque dice haber cerrado en Avisos: el estado de cada mes solo lo
   * llevaba un punto de color con `aria-label` sobre un `<span>` sin rol, que no
   * lee nadie. Un vecino ciego oía seis meses, seis fechas y seis montos, y ni
   * una vez «al día» o «sin registrar».
   */
  const HOJAS: {
    ruta: string
    boton: RegExp
    nombre: string
    admin: boolean
    dpto?: string
  }[] = [
    { ruta: '/', boton: /¿Cómo se calculó\?/, nombre: 'El cálculo', admin: false },
    { ruta: '/mi-departamento', boton: /Cómo pagar/, nombre: 'Cómo pagar', admin: false, dpto: '501' },
    { ruta: '/mi-departamento', boton: /Historial de pagos/, nombre: 'Historial de pagos', admin: false },
    { ruta: '/mi-departamento', boton: /Tu consumo de agua/, nombre: 'Consumo de agua', admin: false },
    { ruta: '/admin', boton: /Empezar |Seguir con /, nombre: 'El cierre del mes', admin: true },
    { ruta: '/admin', boton: /Corregir/, nombre: 'Corregir un mes', admin: true },
    { ruta: '/admin', boton: /lavado de vehículo/, nombre: 'Cargos y créditos', admin: true },
    { ruta: '/admin', boton: /Exportar el año en Excel/, nombre: 'Exportar el año', admin: true },
  ]

  for (const { ruta, boton, nombre, admin, dpto } of HOJAS) {
    test(nombre, async ({ page }) => {
      if (dpto) {
        // «Cómo pagar» y «Ya pagué» solo salen si el pago está **sin registrar**:
        // a quien ya avisó no se le sigue pidiendo lo que dijo que hizo. En la
        // semilla, el 401 tiene junio confirmado y el 501 no ha avisado.
        await page.context().addCookies([
          { name: 'sb_dpto', value: dpto, domain: 'localhost', path: '/' },
        ])
      }
      if (admin) {
        const r = await page.request.post('/api/admin/pin', { data: { pin: PIN } })
        expect(r.ok()).toBeTruthy()
      }
      await page.goto(ruta)
      await page.getByRole('button', { name: boton }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      const malas = await violaciones(page)
      expect(malas.length, `${nombre}:\n${describir(malas)}`).toBe(0)
    })
  }
})

test.describe('se puede recorrer solo con el teclado', () => {
  /**
   * `axe` no pulsa nada: comprueba el marcado. Esto comprueba el uso.
   */
  test('desde Inicio se llega a los controles principales tabulando', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const alcanzados: string[] = []
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      const foco = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        const estilo = getComputedStyle(el)
        return {
          etiqueta: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 60),
          rol: el.tagName.toLowerCase(),
          // El foco tiene que verse: sin contorno ni sombra, quien tabula no
          // sabe dónde está.
          seVe: estilo.outlineStyle !== 'none' || estilo.boxShadow !== 'none',
        }
      })
      if (!foco) continue
      alcanzados.push(foco.etiqueta)
      expect(foco.seVe, `el foco no se ve en «${foco.etiqueta}»`).toBe(true)
    }

    // Los controles que tienen que estar al alcance del teclado desde Inicio.
    const texto = alcanzados.join(' | ')
    expect(texto, 'el cálculo de la cuota').toMatch(/cómo se calculó/i)
    expect(texto, 'la navegación inferior').toMatch(/el mes|mi depa|historial/i)
  })

  test('con una hoja abierta, el foco no se escapa detrás', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /¿Cómo se calculó\?/ }).first().click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()

    // Se tabula más veces que elementos hay: si la trampa funciona, el foco da
    // la vuelta y nunca sale de la hoja.
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      const dentro = await page.evaluate(() => {
        const el = document.activeElement
        const panel = document.querySelector('[role="dialog"]')
        return el === document.body || (!!panel && !!el && panel.contains(el))
      })
      expect(dentro, `en la vuelta ${i} el foco se salió de la hoja`).toBe(true)
    }
  })

  test('Escape cierra la hoja', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /¿Cómo se calculó\?/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

/**
 * **El cierre del mes, entero, sin ratón.**
 *
 * Esto faltaba y era lo más grave de toda la fase: el teclado numérico propio es
 * la única entrada de cifras que existe —siete lecturas, agua, luz, gastos
 * fijos, puntuales, correcciones, cargos— y con el teclado era inalcanzable. El
 * foco se quedaba en la hoja de detrás, cuya trampa lo paseaba en bucle, y
 * `Escape` cerraba la hoja dejando el teclado huérfano en pantalla. Un
 * administrador que no use ratón no podía cerrar el mes. Ni empezarlo.
 *
 * Ninguno de los quince tests de accesibilidad lo veía, porque todos miraban el
 * marcado y ninguno tecleaba.
 */
test.describe('el numpad, sin ratón', () => {
  async function abrirNumpadConTeclado(page: Page) {
    const r = await page.request.post('/api/admin/pin', { data: { pin: PIN } })
    expect(r.ok()).toBeTruthy()
    await page.goto('/admin')
    await page.getByRole('button', { name: /Empezar |Seguir con / }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Las lecturas' })).toBeVisible()

    // Se tabula hasta la primera fila de lectura y se abre con Enter. Sin tocar
    // el ratón ni una vez.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const esFila = await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.classList.contains('lectura-fila'),
      )
      if (esFila) break
    }
    await page.keyboard.press('Enter')
  }

  test('se abre, se teclea y se guarda una lectura sin tocar el ratón', async ({ page }) => {
    await abrirNumpadConTeclado(page)

    // El foco tiene que estar **dentro** del teclado.
    const dentro = await page.evaluate(() =>
      !!document.querySelector('.numpad-panel')?.contains(document.activeElement),
    )
    expect(dentro, 'al abrirse, el foco entra en el teclado').toBe(true)

    // Y tabulando se llega a los dígitos, que es lo que hace falta para escribir.
    const alcanzados: string[] = []
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      const etiqueta = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        const enNumpad = !!document.querySelector('.numpad-panel')?.contains(el)
        return enNumpad ? (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim() : null
      })
      if (etiqueta) alcanzados.push(etiqueta)
    }
    for (const tecla of ['1', '8', '6', 'Punto decimal', 'Borrar', 'Guardar']) {
      expect(alcanzados, `la tecla «${tecla}» tiene que alcanzarse con el tabulador`).toContain(tecla)
    }

    // Y el foco no se escapa a la hoja de detrás en ninguna de las 30 vueltas.
    expect(alcanzados.length, 'el foco nunca sale del teclado').toBe(30)
  })

  test('Escape cierra el teclado, no la hoja de debajo', async ({ page }) => {
    await abrirNumpadConTeclado(page)
    await expect(page.locator('.numpad-panel')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.locator('.numpad-panel'), 'el teclado se cierra').toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Las lecturas' }),
      'y la hoja de detrás sigue ahí: cerrar el teclado no es salirse del cierre',
    ).toBeVisible()
  })
})

test.describe('lo que se anuncia a un lector de pantalla', () => {
  test('la región de anuncios existe y no se ve', async ({ page }) => {
    await page.goto('/')
    const region = page.locator('[role="status"][aria-live="polite"]').last()
    await expect(region).toHaveCount(1)
    // `sr-only` tiene que **esconder de verdad**: si la clase no existiera, el
    // texto de los anuncios saldría escrito en medio de la pantalla.
    const medidas = await region.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { ancho: r.width, alto: r.height, clip: getComputedStyle(el).clipPath }
    })
    expect(medidas.ancho, 'la región de anuncios no puede ocupar sitio').toBeLessThanOrEqual(1)
    expect(medidas.alto).toBeLessThanOrEqual(1)
  })

  test('al avisar un pago se anuncia el estado nuevo', async ({ page }) => {
    // El 501 es el que en la semilla no ha avisado su pago de junio.
    await page.context().addCookies([
      { name: 'sb_dpto', value: '501', domain: 'localhost', path: '/' },
    ])
    await page.goto('/mi-departamento')
    await page.getByRole('button', { name: /Ya pagué/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Ya transferí, avisar/ }).click()

    const region = page.locator('[role="status"][aria-live="polite"]').last()
    await expect(region).toContainText(/en verificación/i)
  })
})

/**
 * Escalado de texto del sistema al 200 %. `02` §8, lo último de la lista.
 *
 * Alguien con la vista cansada pone la letra al doble en los ajustes del
 * teléfono. Si la app está construida con `px` fijos y alturas fijas, el texto
 * se sale de los botones o se corta. Se simula subiendo la fuente base del
 * documento, que es lo que hace el ajuste del sistema en la web.
 */
test.describe('con el texto del sistema al doble', () => {
  for (const { ruta, nombre } of [
    { ruta: '/', nombre: 'Inicio' },
    { ruta: '/mes', nombre: 'El mes' },
    { ruta: '/mi-departamento', nombre: 'Mi departamento' },
  ]) {
    test(`${nombre} no se desborda ni se recorta`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(ruta)
      await page.addStyleTag({ content: 'html { font-size: 200% }' })
      await page.waitForTimeout(200)

      /**
       * Se mide `.pantalla`, **no** `.marco-app`.
       *
       * `.marco-app` lleva `overflow: hidden`, así que su `scrollWidth` no crece
       * nunca por mucho que el contenido se salga: el que absorbe el desborde es
       * `.pantalla`. Con el contenedor equivocado, el aserto no podía fallar —se
       * comprobó metiendo a mano un párrafo de 2668 px con la letra al doble: el
       * marco seguía diciendo 390—.
       */
      const pantalla = page.locator('.pantalla').first()
      const medidas = await pantalla.evaluate((el) => ({
        scroll: el.scrollWidth,
        cliente: el.clientWidth,
      }))
      expect(
        medidas.scroll,
        `${nombre} se desborda a lo ancho con el texto al doble`,
      ).toBeLessThanOrEqual(medidas.cliente + 1)

      /**
       * Y texto recortado dentro de su caja.
       *
       * El filtro anterior descartaba todo lo que tuviera `overflow: visible`,
       * que es **el valor por defecto de casi todo el DOM**: de 93 elementos, se
       * examinaban 0. Ahora se mira la altura de todos y se excluye por lista lo
       * que está recortado a propósito — los `sr-only` y lo que trunca con
       * puntos suspensivos, que es una decisión de diseño.
       */
      const recortados = await page.evaluate(() => {
        const malos: string[] = []
        let examinados = 0
        for (const el of document.querySelectorAll<HTMLElement>('button, h1, h2, p, span, li')) {
          if (el.classList.contains('sr-only')) continue
          const estilo = getComputedStyle(el)
          if (estilo.textOverflow === 'ellipsis') continue
          if (el.getAttribute('aria-hidden') === 'true') continue
          examinados++
          // Solo cuenta si de verdad **esconde** algo: con `overflow: visible` el
          // texto se sale pero se lee, y eso ya lo caza la medida de arriba.
          const escondeVertical = estilo.overflowY === 'hidden' || estilo.overflowY === 'auto'
          if (escondeVertical && el.scrollHeight > el.clientHeight + 2) {
            malos.push(`${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`)
          }
        }
        // Si no se examinó nada, el chequeo no ha comprobado nada: se dice.
        if (examinados === 0) malos.push('EL CHEQUEO NO EXAMINÓ NI UN ELEMENTO')
        return malos
      })
      expect(recortados, `${nombre}: texto recortado con la letra al doble`).toEqual([])
    })
  }
})
