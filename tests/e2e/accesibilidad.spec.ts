import AxeBuilder from '@axe-core/playwright'
import type { Result } from 'axe-core'
import { expect, test, type Page } from './basedatos'
import { culpablesDeDesborde } from './desborde'

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
 * Escalado de texto del sistema al doble. `02` §8, lo último de la lista.
 *
 * Alguien con la vista cansada —o la mamá de la usuaria, que fue quien
 * reportó esto de verdad— pone la letra más grande en los ajustes de
 * accesibilidad del teléfono. Toda la tipografía de este proyecto es `px`
 * fijo (`02` §2), a propósito, así que el mecanismo real que hay que imitar
 * no es `html { font-size: 200% }` —eso solo mueve texto sin clase propia,
 * que hereda del `html`; toda la tipografía con clase (`tipo-titulo-*`,
 * `tipo-cifra-*`, `tipo-pildora`…) se queda exactamente igual, medido: un
 * `<h1 class="tipo-titulo-pantalla">` se quedó en 27px con el truco puesto—.
 * Es el ajuste real de accesibilidad el que reescala CADA nodo de texto por
 * un factor fijo sin que importe la unidad con la que se declaró: así
 * funciona iOS Safari ignorando `px` (nunca lo toca) y así funciona el
 * "tamaño de letra" de Android (si escala `px`, lo hace nodo por nodo, no
 * heredando desde la raíz). `escalarTexto` imita ESE mecanismo.
 *
 * `escalarTexto` mide TODO antes de escribir NADA (dos pasadas): medir y
 * escribir en la misma pasada, en orden de documento, hace que un elemento
 * sin tipografía propia lea el tamaño YA escalado de su padre como si fuera
 * el original y componga el factor otra vez —de 14px a 236px en cinco
 * niveles de anidamiento, medido—, un falso desborde que no existe en la
 * pantalla real.
 */
async function escalarTexto(page: Page, factor: number) {
  await page.evaluate((f) => {
    const marca = '__escalaOriginal'
    const nodos = [...document.querySelectorAll('body, body *')].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    )
    const pares = nodos.map((el) => {
      const guardado = (el as unknown as Record<string, number>)[marca]
      if (guardado !== undefined) return [el, guardado] as const
      const base = parseFloat(getComputedStyle(el).fontSize) || 0
      ;(el as unknown as Record<string, number>)[marca] = base
      return [el, base] as const
    })
    for (const [el, base] of pares) {
      if (base > 0) el.style.setProperty('font-size', `${base * f}px`, 'important')
    }
  }, factor)
  await page.waitForTimeout(200)
}
/**
 * Una sola copia de la regla (`06` §2.7): la usan tanto el bucle de
 * pantallas de vecino como Onboarding, que necesita su propio test porque
 * arranca sin la cookie `sb_dpto` que el resto de la suite trae por
 * defecto.
 */
async function noSeDesbordaNiSeRecorta(page: Page, nombre: string) {
  /**
   * `culpablesDeDesborde`, la misma de `responsive.spec.ts` (`06` §2.7: una
   * sola copia). Mide cada elemento contra `.marco-app` en vez del
   * `scrollWidth` de `.pantalla`: esta última versión se coló con el
   * carrusel de meses (`.selector-meses`) marcado como desborde en "El mes"
   * —un hijo `flex` sin `min-width:0` puede propagar su ancho mínimo al
   * padre aunque el propio hijo scrollee bien—, y `culpablesDeDesborde` ya
   * perdona explícitamente lo que lleva `data-scroll-x`.
   */
  const { culpables, examinados } = await culpablesDeDesborde(page)
  expect(
    examinados,
    `el barrido no miró ni un elemento en ${nombre} con el texto al doble: no probó nada`,
  ).toBeGreaterThan(20)
  expect(culpables, `${nombre} se desborda a lo ancho con el texto al doble`).toEqual([])

  /**
   * Y texto recortado dentro de su caja.
   *
   * El filtro de `h1, h2, p, span, li` solo cuenta si de verdad **esconde**
   * algo (`overflow-y: hidden`/`auto`): con `overflow: visible` el texto se
   * sale pero se lee, y para esos elementos —casi todos `inline`, donde
   * `scrollHeight`/`clientHeight` no es una medida fiable (se probó: sin
   * este filtro, `span.tipo-numero-dpto` marcaba recorte en las cuatro
   * pantallas sin que hubiera ningún defecto real)— esa distinción hace
   * falta.
   *
   * `button` va aparte, sin ese filtro. Un botón sí es una caja con `height`
   * o `min-height` real, y ahí `overflow-y: hidden/auto` no basta:
   * `.admin-pago-boton` con `height` fijo (en vez de `min-height`) pasaba en
   * verde con `overflow` en su valor por defecto (`visible`) aunque
   * "Confirmar contra el estado de cuenta" se desbordara hacia abajo, fuera
   * del fondo oscuro del botón —comprobado reintroduciendo el `height`
   * fijo—, porque `culpablesDeDesborde` solo mira el borde izquierdo/derecho
   * contra `.marco-app`, nunca arriba/abajo. Una caja de altura `auto`
   * SIEMPRE mide `scrollHeight === clientHeight`: que sea mayor ya implica
   * una altura fijada por CSS, la tenga o no `overflow:hidden`.
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
      const esBoton = el.tagName === 'BUTTON'
      const escondeVertical = estilo.overflowY === 'hidden' || estilo.overflowY === 'auto'
      if ((esBoton || escondeVertical) && el.scrollHeight > el.clientHeight + 2) {
        malos.push(`${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`)
      }
    }
    // Si no se examinó nada, el chequeo no ha comprobado nada: se dice.
    if (examinados === 0) malos.push('EL CHEQUEO NO EXAMINÓ NI UN ELEMENTO')
    return malos
  })
  expect(recortados, `${nombre}: texto recortado con la letra al doble`).toEqual([])
}

test.describe('con el texto del sistema al doble', () => {
  for (const { ruta, nombre } of [
    { ruta: '/', nombre: 'Inicio' },
    { ruta: '/mes', nombre: 'El mes' },
    { ruta: '/mi-departamento', nombre: 'Mi departamento' },
    { ruta: '/historial', nombre: 'Historial' },
  ]) {
    test(`${nombre} no se desborda ni se recorta`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      await escalarTexto(page, 2)
      await noSeDesbordaNiSeRecorta(page, nombre)
    })
  }

  /**
   * Administración: la única pantalla con una palabra suelta lo bastante
   * larga para desbordar sin dónde partir ("Administración"), y donde el
   * botón "Confirmar contra el estado de cuenta" perdía el fondo al pasar a
   * dos líneas.
   */
  test('Administración no se desborda ni se recorta', async ({ page }) => {
    const r = await page.request.post('/api/admin/pin', { data: { pin: PIN } })
    expect(r.ok()).toBeTruthy()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await escalarTexto(page, 2)
    await noSeDesbordaNiSeRecorta(page, 'Administración')
  })

  /**
   * Onboarding: la primera pantalla que alguien ve. Necesita `clearCookies`:
   * el resto de la suite trae `sb_dpto` puesto por defecto, y con la cookie
   * puesta esta ruta pinta Inicio, no Onboarding.
   */
  test('Onboarding no se desborda ni se recorta', async ({ page }) => {
    await page.context().clearCookies()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/¿Cuál es tu departamento\?/)).toBeVisible()
    await escalarTexto(page, 2)
    await noSeDesbordaNiSeRecorta(page, 'Onboarding')
  })
})
