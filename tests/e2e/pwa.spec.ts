import { COLOR_TEMA } from '@/lib/tema'
import { expect, test } from './basedatos'

/**
 * PWA: manifiesto, iconos y sin conexión. Fase 6, puntos 1 y 2 del enunciado y
 * punto 2 del verificador.
 *
 * Lo que **no** se puede comprobar aquí y está declarado en
 * `docs/verificacion-6.md`: instalarla en un iPhone y un Android de verdad, y
 * escucharla con VoiceOver o TalkBack. Eso necesita aparatos.
 */

test.describe('el manifiesto y los iconos', () => {
  test('el manifiesto declara lo que pide el enunciado', async ({ page }) => {
    const r = await page.request.get('/manifest.webmanifest')
    expect(r.ok(), 'el manifiesto tiene que existir').toBeTruthy()
    const m = await r.json()

    expect(m.short_name, 'el nombre corto del enunciado').toBe('Salazar Barreto')
    // El color de tema sale de `lib/tema.ts`, que a su vez tiene un test que lo
    // compara con el token `--color-crema` de globals.css.
    expect(String(m.theme_color).toUpperCase()).toBe(COLOR_TEMA.toUpperCase())
    expect(m.display, 'instalable a pantalla completa, sin barra de navegador').toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.lang).toBe('es-PE')

    // Los cuatro iconos: dos normales y dos recortables, 192 y 512.
    const tamanos = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`)
    expect(tamanos).toContain('192x192/any')
    expect(tamanos).toContain('512x512/any')
    expect(tamanos).toContain('192x192/maskable')
    expect(tamanos).toContain('512x512/maskable')
  })

  /**
   * Los iconos se leen **del manifiesto**, no de una lista escrita en el test.
   *
   * Con la lista a mano, cambiar los `src` del manifiesto a rutas inexistentes
   * dejaba los ocho tests en verde: comprobaban que existieran unos ficheros que
   * nadie usaba. Chrome no ofrecería «Instalar» sin un icono descargable, y el
   * chequeo no se enteraba. Y se comprueba **el tamaño real** del PNG contra el
   * que el manifiesto declara: un icono de 32 px anunciado como 512 no sirve.
   */
  test('cada icono del manifiesto existe, es PNG, y mide lo que dice', async ({ page }) => {
    const m = await (await page.request.get('/manifest.webmanifest')).json()
    expect(m.icons.length, 'el manifiesto tiene que declarar iconos').toBeGreaterThan(0)

    for (const icono of m.icons as { src: string; sizes: string }[]) {
      const r = await page.request.get(icono.src)
      expect(r.ok(), `${icono.src} tiene que existir`).toBeTruthy()
      const cuerpo = await r.body()
      // La firma de un PNG. Que la ruta responda 200 no basta: un 200 con el
      // HTML de la página de inicio también responde 200.
      expect(
        cuerpo.subarray(0, 8).toString('hex'),
        `${icono.src} tiene que ser un PNG, no otra cosa que responde 200`,
      ).toBe('89504e470d0a1a0a')
      // El IHDR de un PNG lleva ancho y alto en los bytes 16–24.
      const ancho = cuerpo.readUInt32BE(16)
      const alto = cuerpo.readUInt32BE(20)
      const [declarado] = icono.sizes.split('x').map(Number)
      expect(ancho, `${icono.src} dice medir ${icono.sizes}`).toBe(declarado)
      expect(alto).toBe(declarado)
    }

    // Y el de iOS, que no va en el manifiesto sino en un `<link>`.
    const apple = await page.request.get('/iconos/apple-touch-icon.png')
    expect(apple.ok()).toBeTruthy()
    expect((await apple.body()).readUInt32BE(16)).toBe(180)
  })

  /**
   * Las condiciones que Chrome exige para ofrecer "Instalar".
   *
   * Esto es lo que comprobaba la auditoría `installable-manifest` de Lighthouse,
   * **retirada en la versión 12** junto con la categoría `pwa` entera. Sin este
   * test, el punto 6 del verificador —«PWA instalable»— no lo comprobaría nadie:
   * el script de Lighthouse preguntaba por una auditoría que ya no existe, y
   * `undefined === 1` es siempre falso.
   */
  test('cumple las condiciones de instalación de Chrome', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const m = await (await page.request.get('/manifest.webmanifest')).json()
    expect(m.name, 'nombre').toBeTruthy()
    expect(m.short_name, 'nombre corto').toBeTruthy()
    expect(m.start_url, 'url de arranque').toBeTruthy()
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(m.display)
    // Al menos un icono de 192 o más, que es el mínimo de Chrome.
    const grandes = m.icons.filter((i: { sizes: string }) => Number(i.sizes.split('x')[0]) >= 192)
    expect(grandes.length, 'un icono de 192px o más').toBeGreaterThan(0)

    // Y un service worker **que de verdad intercepte peticiones**.
    //
    // Antes esto era `expect(fuente).toContain("addEventListener('fetch'")` —un
    // `grep` sobre el texto— y `expect(alcance).toMatch(/\/$/)`, que es
    // tautológico porque todo alcance termina en barra. Con un manejador de
    // `fetch` completamente vacío, seis de los ocho tests seguían pasando.
    const sw = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready
      return { activo: r.active?.state ?? null, alcance: r.scope }
    })
    expect(sw.activo, 'el service worker tiene que estar activo').toBe('activated')
    expect(sw.alcance, 'el alcance tiene que ser el origen').toBe(new URL('/', page.url()).href)
  })

  /**
   * Y que interceptar **sirva de algo**: una URL ya visitada tiene que salir de
   * la caché con la red cortada. Es la única comprobación que distingue un
   * service worker que funciona de uno cuyo manejador de `fetch` está vacío.
   */
  test('el service worker sirve de la caché lo ya visitado', async ({ page, context }) => {
    await page.goto('/mes')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // La **primera** visita de todas no queda guardada: cuando llegó, el service
    // worker todavía no existía. Es cierto en la app y conviene que el test lo
    // diga en vez de disimularlo: quien instala la app y se queda sin señal en
    // ese mismo instante, no tiene copia. La segunda visita sí.
    await page.reload()
    await page.waitForLoadState('networkidle')

    /**
     * Se recarga **la navegación**, no un `fetch` suelto.
     *
     * Un `fetch('/mes/2026-06')` desde la página no tiene `mode: 'navigate'`, así
     * que el manejador de navegaciones del service worker ni lo mira: se va a la
     * red y falla. La comprobación de verdad es que la pantalla vuelva a salir
     * con la red cortada, y que la respuesta venga **marcada** como guardada,
     * que es lo que distingue un service worker que sirve de uno que no.
     */
    const marcas: string[] = []
    page.on('response', (r) => {
      const m = r.headers()['x-sb-desde-cache']
      if (m) marcas.push(`${new URL(r.url()).pathname}:${m}`)
    })

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText('Costó mantener el edificio')).toBeVisible()
    await context.setOffline(false)

    expect(marcas.length, 'la respuesta tiene que venir marcada como guardada').toBeGreaterThan(0)
  })

  /**
   * El test se llamaba así y **no comprobaba el icono de iOS**: solo el
   * manifiesto y el color de tema. El título era la única parte que mencionaba
   * iOS, y el `<link rel="apple-touch-icon">` no existía en ninguna página.
   */
  test('la página enlaza el manifiesto y el icono de iOS', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)

    const apple = page.locator('link[rel="apple-touch-icon"]')
    await expect(apple, 'iOS busca este enlace; sin él instala una captura').toHaveCount(1)
    const href = await apple.getAttribute('href')
    const r = await page.request.get(String(href))
    expect(r.ok(), `${href} tiene que existir`).toBeTruthy()

    const tema = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(String(tema).toUpperCase()).toBe(COLOR_TEMA.toUpperCase())
  })
})

test.describe('sin conexión', () => {
  /**
   * Modo avión: **abre, y avisa**.
   *
   * Las tres preguntas del verificador: ¿abre? ¿avisa que está desconectada?
   * ¿o enseña números viejos como si fueran de ahora? Las tres importan, y la
   * tercera es la que más: un vecino leyendo la cuota del mes pasado creyendo
   * que es la de este mes es exactamente lo que el producto existe para evitar.
   */
  test('la app abre sin conexión y lo dice', async ({ page, context }) => {
    // Primero online, y **dos veces**: en la primera visita el service worker
    // todavía no controlaba la página, así que esa navegación no se guardó.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)
    await page.reload()

    // Abre: se ve la pantalla, no el dinosaurio del navegador.
    await expect(page.getByText(/Tu cuota de/)).toBeVisible()

    // Y lo dice, con las dos cosas: que no hay conexión y que lo que se ve es
    // lo último guardado.
    const aviso = page.getByRole('status').filter({ hasText: /Sin conexión/ })
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText(/lo último que se guardó/)

    await context.setOffline(false)
  })

  test('en administración avisa que no se puede guardar', async ({ page, context }) => {
    const r = await page.request.post('/api/admin/pin', { data: { pin: process.env.ADMIN_PIN ?? '2026' } })
    expect(r.ok()).toBeTruthy()
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)
    await page.reload()

    const aviso = page.getByRole('status').filter({ hasText: /Sin conexión/ })
    await expect(aviso).toBeVisible()
    // Un administrador a punto de teclear siete lecturas tiene que saber antes
    // de empezar que no se van a guardar.
    await expect(aviso).toContainText(/no se puede guardar/)

    await context.setOffline(false)
  })

  test('con conexión no hay aviso: un aviso permanente no es un aviso', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Sin conexión/)).toHaveCount(0)
  })

  /**
   * El service worker **no guarda escrituras**.
   *
   * Encolar en silencio el cierre de un mes para mandarlo «cuando vuelva la
   * señal» acaba publicando dos veces, o publicando datos viejos encima de los
   * nuevos. Sin señal, una escritura falla, y falla a la vista.
   */
  test('una escritura sin conexión falla, no se encola', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await context.setOffline(true)

    const resultado = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/pagos/aviso', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mes: '2026-06', dpto: '501' }),
        })
        return { ok: r.ok, estado: r.status }
      } catch {
        return { ok: false, estado: 0 }
      }
    })
    expect(resultado.ok, 'sin conexión, una escritura no puede salir bien').toBe(false)

    await context.setOffline(false)
    // Y al volver la señal, nada se ha mandado por su cuenta.
    const pagos = await (await page.request.get('/api/meses/2026-06')).json()
    expect(pagos.pagos['501'] ?? null, 'el aviso no puede haberse encolado').toBeNull()
  })
})
