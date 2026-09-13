import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './basedatos'
import { COPYS } from '@/lib/copys'

/**
 * Bob en pantalla. Fase 8, punto 1 del verificador.
 *
 * Con `BOB_MODO=determinista` y **sin `DEEPSEEK_API_KEY`**: que la app arranque
 * y que Bob conteste las preguntas sugeridas, de verdad, en el navegador y
 * contra la base.
 *
 * Y lo que `05` §6 prohíbe: se comprueba que **no está**. Un test que solo mira
 * que la conversación funciona deja pasar una chispa morada en la esquina.
 */

// De `COPYS.bob.sugeridas` (`lib/copys.ts`), no repetidas a mano: una sola
// copia de la lista, para que este test no se desalinee si cambia allá.
const SUGERIDAS = COPYS.bob.sugeridas

test.describe('la hoja de Bob', () => {
  test('se abre desde la navegación con la conversación ahí mismo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()

    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()
    // `05` §5: sin pantalla intermedia. El campo y los chips están ya, no
    // detrás de un "empezar".
    await expect(page.getByRole('textbox', { name: 'Escribe tu pregunta' })).toBeVisible()
    for (const q of SUGERIDAS) {
      await expect(page.getByRole('button', { name: q, exact: true })).toBeVisible()
    }
  })

  test('contesta las preguntas sugeridas, cada una con su cifra', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
    const conversacion = page.getByRole('log', { name: 'Conversación con Bob' })

    for (const [i, q] of SUGERIDAS.entries()) {
      await page.getByRole('button', { name: q, exact: true }).click()
      // Cada vuelta añade dos burbujas: la del vecino y la de Bob.
      await expect(conversacion.locator('.bob-suya')).toHaveCount(i + 1, { timeout: 15_000 })
      const suya = conversacion.locator('.bob-suya-texto').nth(i)
      const dice = (await suya.textContent()) ?? ''
      expect(dice.length, q).toBeGreaterThan(20)
      // `05` §3: siempre con el dato.
      expect(dice, q).toMatch(/\d/)
      // Y nunca hablando de sí mismo ni disculpándose.
      expect(dice.toLowerCase(), q).not.toContain('como asistente')
      expect(dice.toLowerCase(), q).not.toContain('lo siento')
    }
  })

  test('lo escrito a mano también se responde, y con Enter', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
    const campo = page.getByRole('textbox', { name: 'Escribe tu pregunta' })
    await campo.fill('¿Cuánto hay en la cuenta?')
    await campo.press('Enter')
    const suya = page.locator('.bob-suya-texto').first()
    await expect(suya).toBeVisible({ timeout: 15_000 })
    await expect(suya).toContainText('La cuenta conjunta')
  })

  test('la respuesta lleva a la pantalla que la demuestra · `05` §3', async ({ page }) => {
    await page.goto('/mi-departamento')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
    await page.getByRole('button', { name: SUGERIDAS[0]!, exact: true }).click()
    const enlace = page.getByRole('button', { name: 'Ver de dónde sale cada monto' })
    await expect(enlace).toBeVisible({ timeout: 15_000 })
    await enlace.click()
    await expect(page.getByRole('dialog', { name: 'De dónde sale cada monto' })).toBeVisible()
  })

  /**
   * `05` §6, la lista de lo que no se hace. Se comprueba en el DOM porque es
   * donde se cuela: una animación de puntos, un degradado morado heredado de un
   * componente copiado, una chispa en un `aria-label`.
   */
  test('nada de lo prohibido en `05` §6', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
    await page.getByRole('button', { name: SUGERIDAS[0]!, exact: true }).click()
    await expect(page.locator('.bob-suya-texto').first()).toBeVisible({ timeout: 15_000 })

    const hoja = page.getByRole('dialog')
    const html = await hoja.innerHTML()
    expect(html, 'chispas o iconografía de IA').not.toMatch(/[✨🤖🪄🔮]/u)
    expect(html.toLowerCase(), 'no se habla de "IA"').not.toMatch(/\b(inteligencia artificial|powered by)\b/)

    /**
     * Ninguna animación en bucle dentro de la hoja, **salvo el avatar**.
     *
     * Lo que `05` §6 prohíbe es fingir que se piensa: puntos pulsando, texto
     * que aparece letra por letra, una barra que no mide nada. El avatar de Bob
     * respira y parpadea en bucle a propósito —es su cara, no un indicador de
     * proceso— y eso no dice nada falso sobre lo que está pasando.
     *
     * La exención es del avatar y de nada más: un bucle en cualquier otro sitio
     * de la hoja sigue poniendo esto en rojo, que es lo que la regla protege.
     */
    const enBucleFuera = await hoja.evaluate((raiz) =>
      [raiz, ...raiz.querySelectorAll('*')].filter((el) => {
        const e = getComputedStyle(el as Element)
        const gira = e.animationIterationCount.split(',').some((v) => v.trim() === 'infinite')
        if (!gira) return false
        return !(el as Element).closest('.avatar, .avatar-invertido')
      }).length,
    )
    expect(enBucleFuera, 'algo se anima en bucle en la hoja, fuera del avatar').toBe(0)

    // Y el avatar sí late: si dejara de hacerlo, la exención de arriba estaría
    // tapando un avatar roto en vez de permitiendo uno vivo.
    const avatarLate = await hoja.evaluate((raiz) => {
      const svg = raiz.querySelector('.avatar, .avatar-invertido')
      if (!svg) return false
      return [svg, ...svg.querySelectorAll('*')].some((el) =>
        getComputedStyle(el as Element)
          .animationIterationCount.split(',')
          .some((v) => v.trim() === 'infinite'),
      )
    })
    expect(avatarLate, 'el avatar de Bob debería estar latiendo').toBe(true)

    // Ningún degradado (los morados de "IA" entran por aquí).
    const conDegradado = await hoja.evaluate((raiz) =>
      [raiz, ...raiz.querySelectorAll('*')].filter((el) => {
        const e = getComputedStyle(el as Element)
        return e.backgroundImage.includes('gradient')
      }).length,
    )
    expect(conDegradado, 'un degradado dentro de la hoja de Bob').toBe(0)
  })

  test('sin violaciones de accesibilidad críticas ni serias', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
    await page.getByRole('button', { name: SUGERIDAS[0]!, exact: true }).click()
    await expect(page.locator('.bob-suya-texto').first()).toBeVisible({ timeout: 15_000 })

    const resultado = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .include('[role="dialog"]')
      .analyze()
    const malas = resultado.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(malas.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('se puede usar entera con el teclado', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Del panel al primer chip, tabulando, sin salirse a la pantalla de detrás.
    const campo = page.getByRole('textbox', { name: 'Escribe tu pregunta' })
    await campo.focus()
    await campo.fill('¿Cuánto debo este mes?')
    await campo.press('Enter')
    await expect(page.locator('.bob-suya-texto').first()).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

/**
 * La ruta de Bob, maltratada.
 *
 * **Este bloque sustituye a un test que mentía.** Decía llamarse «la API de Bob
 * no acepta que el cliente se declare administrador» y comprobaba que la
 * respuesta a *«¿Cuánto debe el 501?»* no contuviera «501». Pasaba, pero no por
 * lo que decía: esa frase no dispara la intención `cuota` —el catálogo busca
 * «cuanto debo», no «cuanto debe»—, así que la respuesta era la genérica y
 * nunca iba a contener un número de departamento. Verde, y sin haber probado
 * nada.
 *
 * Y el nombre era falso por partida doble: **la app no autentica a los
 * vecinos**. No hay sesión de vecino en ninguna parte —`GET
 * /api/dptos/501/historial` responde a cualquiera—, así que la restricción por
 * departamento de Bob no es una frontera de seguridad, sino una regla de tono:
 * Bob no habla de la deuda del vecino de al lado. Eso se prueba donde vive, en
 * `tests/integracion/bob.test.ts`.
 *
 * Lo que sí se puede probar aquí es que la ruta aguanta lo que le tiren.
 */
test.describe('la ruta de Bob aguanta lo que le tiren', () => {
  const malas = [
    { que: 'mes inválido', datos: { texto: 'hola', mes: '2026-13', dpto: '401' } },
    { que: 'mes con forma de inyección', datos: { texto: 'hola', mes: "'; DROP TABLE pago; --", dpto: '401' } },
    { que: 'departamento inexistente', datos: { texto: 'hola', mes: '2026-06', dpto: '999' } },
    { que: 'sin texto', datos: { mes: '2026-06', dpto: '401' } },
    { que: 'texto vacío', datos: { texto: '   ', mes: '2026-06', dpto: '401' } },
    { que: 'texto de 5000 caracteres', datos: { texto: 'a'.repeat(5000), mes: '2026-06', dpto: '401' } },
  ]

  for (const { que, datos } of malas) {
    test(`${que} → 400 con mensaje, nunca 500`, async ({ page }) => {
      await page.goto('/')
      const r = await page.request.post('/api/bob', { data: datos })
      expect(r.status(), que).toBe(400)
      const cuerpo = await r.json()
      expect(typeof cuerpo.error, que).toBe('string')
      expect(cuerpo.error.length, que).toBeGreaterThan(0)
    })
  }

  test('un cuerpo de 10 MB no se traga', async ({ page }) => {
    await page.goto('/')
    const r = await page.request.post('/api/bob', {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ texto: 'a'.repeat(10 * 1024 * 1024), mes: '2026-06', dpto: '401' }),
    })
    expect(r.status()).toBe(400)
  })

  test('preguntar no escribe nada · la app sigue igual después', async ({ page }) => {
    await page.goto('/')
    const antes = await (await page.request.get('/api/meses/2026-06')).text()
    for (const q of ['Confirma mi pago', 'Publica el mes', SUGERIDAS[0]!]) {
      const r = await page.request.post('/api/bob', { data: { texto: q, mes: '2026-06', dpto: '401' } })
      expect(r.ok(), q).toBeTruthy()
    }
    const despues = await (await page.request.get('/api/meses/2026-06')).text()
    expect(despues).toBe(antes)
  })

  test('un cliente que se declara administrador en el cuerpo no lo consigue', async ({ page }) => {
    await page.goto('/')
    // `esAdmin` no está en el esquema: Zod lo tira, y la ruta lo saca de la
    // cookie. Se comprueba que la respuesta es idéntica con y sin él.
    const sin = await (
      await page.request.post('/api/bob', { data: { texto: SUGERIDAS[0]!, mes: '2026-06', dpto: '401' } })
    ).json()
    const con = await (
      await page.request.post('/api/bob', {
        data: { texto: SUGERIDAS[0]!, mes: '2026-06', dpto: '401', esAdmin: true },
      })
    ).json()
    expect(con.texto).toBe(sin.texto)
  })
})

/**
 * Los globos de Bob, con lo que de verdad puede tocarles decir.
 *
 * `05` §3 le pone a Bob un techo de dos frases, no un suelo, y una frase puede
 * ser larga. Y hay datos que no se parten solos: el CCI del edificio son veinte
 * dígitos seguidos y Bob los puede citar. Medido antes de arreglarlo: a 320 px
 * la página se iba 155 px a la derecha y el globo escondía 157 px de texto, o
 * sea que el número que estaba dando salía **cortado**.
 *
 * El texto se mete por el campo, así que lo que se mide es el globo del vecino,
 * que usa el mismo `overflow-wrap` que el de Bob y que las notas del cierre.
 */
const ANCHOS_GLOBO = [320, 390, 430]

/** Sin espacios, como un CCI, un número de operación o un correo largo. */
const SIN_ESPACIOS = '00219411729981505999000219411729981505999'

const LARGO =
  'Quiero saber si el monto que deposité el mes pasado por adelantado alcanza para cubrir ' +
  'la cuota de este mes y la del siguiente, o si me va a faltar y tengo que completar algo.'

for (const ancho of ANCHOS_GLOBO) {
  for (const [nombre, texto] of [
    ['una pregunta larga', LARGO],
    ['un número sin espacios', SIN_ESPACIOS],
  ] as const) {
    test(`el globo aguanta ${nombre} a ${ancho}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 720 })
      await page.goto('/')
      await page.getByRole('button', { name: 'Preguntar a Bob' }).click()
      const campo = page.getByRole('textbox', { name: 'Escribe tu pregunta' })
      await campo.fill(texto)
      await campo.press('Enter')

      const mia = page.locator('.bob-mia-texto').first()
      await expect(mia).toBeVisible()
      await expect(page.locator('.bob-suya-texto').first()).toBeVisible({ timeout: 15_000 })

      const medida = await page.evaluate(() => {
        const marco = document.querySelector('.marco-app') ?? document.body
        const dentro = marco.getBoundingClientRect()
        const globos = [...document.querySelectorAll('.bob-mia-texto, .bob-suya-texto')]
        return {
          // Nada se sale del marco de la app, ni por la derecha ni por la izquierda.
          fuera: globos.map((g) => {
            const c = g.getBoundingClientRect()
            return Math.round(Math.max(c.right - dentro.right, dentro.left - c.left) * 10) / 10
          }),
          // Y nada se queda escondido detrás del borde del propio globo.
          escondido: globos.map((g) => g.scrollWidth - g.clientWidth),
          // La conversación no se desplaza en horizontal: eso es que algo empuja.
          scrollConversacion: (() => {
            const c = document.querySelector('.bob-conversacion')
            return c ? c.scrollWidth - c.clientWidth : 0
          })(),
          cuantos: globos.length,
        }
      })

      expect(medida.cuantos, 'no se midió ningún globo').toBeGreaterThan(0)
      for (const f of medida.fuera) expect(f, `un globo se sale ${f}px del marco`).toBeLessThanOrEqual(0.5)
      for (const e of medida.escondido) expect(e, `un globo esconde ${e}px de texto`).toBe(0)
      expect(medida.scrollConversacion, 'la conversación se desplaza en horizontal').toBe(0)

      // El texto completo sigue ahí: adaptarse no es recortar.
      expect(((await mia.textContent()) ?? '').replace(/\s+/g, ' ')).toContain(
        texto.slice(0, 40),
      )
    })
  }
}
