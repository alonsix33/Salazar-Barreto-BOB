import { expect, test, type Page } from './basedatos'

/**
 * El cierre del mes, de principio a fin. Fase 5 del verificador.
 *
 * Recorre los siete pasos con los datos reales de julio y comprueba que el
 * resultado coincide **al céntimo** con lo que devuelve el motor. Y comprueba
 * las cosas que tienen que fallar: publicar dos veces, publicar sin cuadrar,
 * y salir a mitad y volver.
 *
 * Requiere sesión de administración: se obtiene con el PIN del entorno.
 */

const JULIO = {
  '101': '186461', '201': '185256', '202': '52513', '301': '441532',
  '401': '438038', '501': '232826', '502': '292678',
} as const
/** Lo que el motor calcula para julio con estos datos. Verificado en la Fase 1. */
const ESPERADO_JULIO = {
  totalMes: '3,374.38',
  cuotas: {
    // Suben todas porque el área común ya no la absorbe el fondo: la pagan los
    // siete por su flat (`01` §3.2, corregida contra la planilla real). El total
    // del mes no se mueve. Los flats del 202 y el 502 son los de la escritura.
    '101': '382.63', '201': '343.54', '202': '684.60', '301': '371.71',
    '401': '389.65', '501': '536.87', '502': '665.38',
  },
}

/** Teclea un número en el teclado numérico propio. */
/**
 * Teclea en el numpad, **comprobando que cada dígito entró** antes del
 * siguiente.
 *
 * La versión anterior disparaba los clics en fila sin mirar la pantalla, y con
 * la máquina cargada eso se transponía: en una corrida completa salió 438.038
 * donde se tecleó 483.038, con el 8 y el 3 cambiados de sitio. En aislado
 * pasaba siempre, así que era fácil llamarlo casualidad y volver a correrlo.
 *
 * No es un `waitForTimeout` disfrazado: se espera a que el visor muestre el
 * prefijo que va escrito, que es exactamente la condición que hacía falta.
 */
async function teclear(page: Page, digitos: string) {
  await expect(page.getByRole('dialog').last()).toBeVisible()
  const visor = page.locator('.numpad-panel .numpad-numero')
  let escrito = ''
  for (const d of digitos) {
    await page.getByRole('button', { name: d === '.' ? 'Punto decimal' : d, exact: true }).click()
    escrito += d
    await expect(visor, `el numpad se quedó atrás al teclear «${escrito}»`).toHaveText(escrito)
  }
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
}

/**
 * Teclea **sin esperar entre dígitos**, que es como teclea una persona con
 * prisa en un teléfono.
 *
 * Es el caso que `teclear` ya no puede reproducir: aquella comprueba el visor
 * después de cada pulsación, así que nunca hay dos sin pintar por medio. Aquí
 * se disparan las doce seguidas a propósito, porque lo que se mide es
 * justamente que no se pierda ninguna.
 */
async function teclearRapido(page: Page, digitos: string) {
  await expect(page.getByRole('dialog').last()).toBeVisible()
  /**
   * Las pulsaciones se disparan **en la misma tarea del navegador**, una detrás
   * de otra sin ceder el hilo. Así es como llegan cuando alguien teclea rápido
   * en un teléfono: React las agrupa en un solo repintado.
   *
   * Con `Promise.all` de clics de Playwright no vale: eso son toques
   * simultáneos, no rápidos, y el propio Playwright descarta la mitad
   * esperando a elementos que se repintan. Medido: de seis dígitos quedaba uno.
   */
  await page.evaluate((ds: string) => {
    const panel = document.querySelector('.numpad-panel')
    if (!panel) throw new Error('el numpad no está abierto')
    for (const d of ds) {
      const etiqueta = d === '.' ? 'Punto decimal' : d
      const boton = [...panel.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === etiqueta,
      )
      if (!boton) throw new Error(`no existe la tecla ${etiqueta}`)
      boton.click()
    }
  }, digitos)
}

/**
 * La versión del cierre de un mes, para el bloqueo optimista.
 *
 * Es obligatoria en toda escritura sobre un mes: sin ella la petición se
 * rechaza con 400. Los tests que llaman a la API directamente tienen que
 * comportarse como el cliente de verdad, o estarían probando otro contrato.
 */
async function versionDe(page: Page, mes: string): Promise<number> {
  const r = await page.request.get(`/api/meses/${mes}`)
  expect(r.ok(), `leer la versión de ${mes}`).toBeTruthy()
  return (await r.json()).version as number
}

async function abrirCierre(page: Page) {
  await page.goto('/admin')
  await page.getByRole('button', { name: /Empezar|Seguir con/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/**
 * **No en serie.** Cada test toma el cerrojo de la base y la rehace desde la
 * semilla, así que no dependen del orden ni se pisan.
 *
 * Estuvieron en `mode: 'serial'` y fue peor: en serie, un test que falla marca
 * los siguientes del fichero como *did not run*. Una corrida real salió
 * `93 passed / 1 failed / 2 did not run` y los dos que se saltaron incluían la
 * única cobertura de la reasignación de agua — un resumen que de reojo se lee
 * como un flake y esconde dos huecos. La regla de la casa es no cortar en el
 * primer rojo.
 */

test.describe('el cierre del mes, paso a paso', () => {
  test('los siete pasos, y el resultado coincide con el motor al céntimo', async ({ page }) => {
    await abrirCierre(page)

    // Paso 0
    await expect(page.getByRole('heading', { name: 'Vamos a cerrar julio' })).toBeVisible()
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()

    // Paso 1 · las siete lecturas
    await expect(page.getByRole('heading', { name: 'Las lecturas' })).toBeVisible()
    await expect(page.getByText('0 / 7')).toBeVisible()
    for (const [dpto, valor] of Object.entries(JULIO)) {
      await page.getByRole('button', { name: new RegExp(`^${dpto}\\b`) }).first().click()
      await teclear(page, `${valor.slice(0, -3)}.${valor.slice(-3)}`)
    }
    await expect(page.getByText('7 / 7')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Paso 2 · la factura de agua
    await expect(page.getByRole('heading', { name: 'La factura de agua' })).toBeVisible()
    await page.getByRole('button', { name: /Consumo de agua del edificio/ }).click()
    await teclear(page, '81')
    await page.getByRole('button', { name: /Monto de la factura de agua/ }).click()
    await teclear(page, '338.60')
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Paso 3 · la luz
    await expect(page.getByRole('heading', { name: 'El recibo de luz común' })).toBeVisible()
    await page.getByRole('button', { name: /Monto del recibo de luz común/ }).click()
    await teclear(page, '361.20')
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Paso 4 · los gastos fijos, ya puestos
    await expect(page.getByRole('heading', { name: 'Los gastos que no cambian' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar y seguir' }).click()

    // Paso 5 · nada puntual este mes
    await expect(page.getByRole('heading', { name: '¿Pasó algo fuera de lo normal?' })).toBeVisible()
    await page.getByRole('button', { name: 'Nada más este mes, seguir' }).click()

    // Paso 6 · la revisión, con las cifras del motor
    await expect(page.getByRole('heading', { name: 'Así queda julio' })).toBeVisible()
    await expect(page.getByText('El agua cuadra exacto')).toBeVisible()
    for (const [dpto, cuota] of Object.entries(ESPERADO_JULIO.cuotas)) {
      const fila = page.locator('.revision-fila').filter({ hasText: dpto })
      await expect(fila, `la cuota del ${dpto}`).toContainText(cuota)
    }
    await expect(page.locator('.revision-cuadre-total')).toContainText(ESPERADO_JULIO.totalMes)
    await page.getByRole('button', { name: 'Todo correcto, seguir' }).click()

    // Paso 7 · publicar
    await expect(page.getByRole('heading', { name: 'La nota del mes' })).toBeVisible()
    await page.getByRole('button', { name: /^Publicar julio/ }).click()
    await expect(page.getByRole('heading', { name: /ya está publicado/ })).toBeVisible()

    // Y el mes queda publicado de verdad: la API lo confirma.
    const r = await page.request.get('/api/meses')
    const { meses } = await r.json()
    const julio = meses.find((m: { mes: string }) => m.mes === '2026-07')
    expect(julio.publicado).toBe(true)
    expect(julio.cuadra).toBe(true)

    /**
     * Y, sobre todo: **que el vecino lo vea al momento**.
     *
     * Las pantallas de vecino leen de una foto del edificio cacheada, que se
     * tira sola en cuanto algo se escribe (`lib/datos/almanaque.ts`). Si esa
     * invalidación fallara, aquí no habría error de ninguna clase: Historial
     * seguiría pintando el mes anterior, rápido y con números coherentes, y la
     * única señal sería que julio no aparece. De ahí que se comprueben las dos
     * caras —que julio está y que su cuota es la que publicó el motor— y no solo
     * que la página carga.
     *
     * Cubre además la caché del enrutador de Next, que es del navegador y no se
     * ve desde el servidor: llegar navegando no es lo mismo que recargar.
     */
    await page.goto('/historial')
    await expect(
      page.locator('a[href="/mes/2026-07"]'),
      'julio no aparece en Historial tras publicarlo',
    ).toBeVisible()

    await page.goto('/mes/2026-07')
    await expect(page.getByText(ESPERADO_JULIO.totalMes).first()).toBeVisible()
  })

  test('se sale a mitad y se vuelve al mismo paso, con los datos escritos', async ({ page }) => {
    await abrirCierre(page)
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()

    await page.getByRole('button', { name: /^101\b/ }).first().click()
    await teclear(page, '186.461')
    await expect(page.getByText('1 / 7')).toBeVisible()

    // Recargar la página entera: es salir de verdad, no cerrar la hoja.
    await page.reload()
    await abrirCierre(page)
    await expect(page.getByRole('heading', { name: 'Las lecturas' })).toBeVisible()
    await expect(page.getByText('1 / 7')).toBeVisible()
    await expect(page.getByText('186.461')).toBeVisible()
  })

  /**
   * La corrección de tecleo, en la pantalla y no en el motor.
   *
   * El motor de `01` §8 estaba probado desde la Fase 1 y **aun así la propuesta
   * no salía nunca**: la regla descarta candidatas comparando contra los m³ de
   * SEDAPAL, el paso 1 va antes del recibo, y preguntada allí `objetivoM3` vale
   * 0 y ninguna candidata sobrevive. Cero propuestas en 11.329 lecturas. Este
   * test existe porque el de motor no lo habría visto.
   */
  test('una lectura con dos dígitos transpuestos: Bob la propone y se acepta', async ({ page }) => {
    await abrirCierre(page)
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()

    // Las siete lecturas de julio, pero el 401 con los dígitos cambiados:
    // 483.038 en vez de 438.038. Es el caso que enseña `04-cierre-del-mes.md`.
    for (const [dpto, valor] of Object.entries({ ...JULIO, '401': '483038' })) {
      await page.getByRole('button', { name: new RegExp(`^${dpto}\\b`) }).first().click()
      await teclear(page, `${valor.slice(0, -3)}.${valor.slice(-3)}`)
    }
    // En el paso 1 todavía no hay recibo, así que nadie propone nada.
    await expect(page.locator('[data-propuesta]')).toHaveCount(0)
    await expect(page.getByText('7 / 7')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Paso 2: en cuanto se escriben los m³, la regla se puede evaluar.
    await expect(page.getByRole('heading', { name: 'La factura de agua' })).toBeVisible()
    await page.getByRole('button', { name: /Consumo de agua del edificio/ }).click()
    await teclear(page, '81')

    const propuesta = page.locator('[data-propuesta="401"]')
    await expect(propuesta).toBeVisible()
    // La frase, literal del documento de diseño.
    await expect(propuesta).toContainText(
      '¿Será 438.038? Con 483.038 el consumo sería 62.40 m³, cuatro veces tu promedio, ' +
        'y el edificio pasaría de lo que facturó SEDAPAL.',
    )

    await propuesta.getByRole('button', { name: 'Sí, es 438.038' }).click()
    await expect(page.locator('[data-propuesta]')).toHaveCount(0)

    // Y la lectura quedó corregida en el servidor, no solo en la pantalla.
    const borrador = await (await page.request.get('/api/meses/2026-07/borrador')).json()
    expect(borrador.lecturas['401']).toBe(438.038)
  })

  /**
   * La rama del paso 1: reeditar una lectura **con el recibo ya escrito**.
   *
   * No la ejercía nadie. Lo único que había del paso 1 era la comprobación de
   * que la propuesta *no* sale antes del recibo, y esa rama tenía además un
   * comportamiento propio: enseñaba la propuesta y **no guardaba** lo tecleado
   * hasta que el administrador pulsara uno de los dos botones. Cerrar la hoja
   * ahí perdía la lectura, en el paso cuya promesa es que se guarda solo.
   */
  test('al volver al paso 1 con el recibo puesto, propone y no pierde lo tecleado', async ({ page }) => {
    await abrirCierre(page)
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()
    for (const [dpto, valor] of Object.entries(JULIO)) {
      await page.getByRole('button', { name: new RegExp(`^${dpto}\\b`) }).first().click()
      await teclear(page, `${valor.slice(0, -3)}.${valor.slice(-3)}`)
    }
    await page.getByRole('button', { name: 'Continuar' }).click()

    // El recibo, que es lo que hace evaluable la regla de §8.
    await page.getByRole('button', { name: /Consumo de agua del edificio/ }).click()
    await teclear(page, '81')
    await page.getByRole('button', { name: /Monto de la factura de agua/ }).click()
    await teclear(page, '338.60')

    // Y se vuelve al paso 1 a reeditar el 401, esta vez mal.
    await page.getByRole('button', { name: 'Volver al paso anterior' }).click()
    await expect(page.getByRole('heading', { name: 'Las lecturas' })).toBeVisible()
    await page.getByRole('button', { name: /^401\b/ }).first().click()
    for (let i = 0; i < 12; i++) {
      await page.getByRole('button', { name: 'Borrar', exact: true }).click()
    }
    await teclear(page, '483.038')

    const propuesta = page.locator('[data-propuesta="401"]')
    await expect(propuesta).toBeVisible()

    // Antes de decidir nada, lo tecleado **ya está en el servidor**.
    const enEspera = await (await page.request.get('/api/meses/2026-07/borrador')).json()
    expect(enEspera.lecturas['401']).toBe(483.038)

    // Y decir que no lo deja como está.
    await propuesta.getByRole('button', { name: 'No, lo dejo así' }).click()
    await expect(page.locator('[data-propuesta]')).toHaveCount(0)
    const despues = await (await page.request.get('/api/meses/2026-07/borrador')).json()
    expect(despues.lecturas['401']).toBe(483.038)
  })

  test('con dos lecturas sospechosas a la vez, no propone ninguna', async ({ page }) => {
    await abrirCierre(page)
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()

    // Dos lecturas mal a la vez: el 101 con dos dígitos cambiados (184.661 por
    // 186.461) y el 201 con uno mal (175.256 por 185.256).
    //
    // La escena que había antes —el 401 y el 101 transpuestos— **no producía
    // ningún sospechoso**, así que el test pasaba por vacío: quitarle la regla lo
    // dejaba igual de verde. Con estas dos, la regla encuentra tres candidatos
    // (201, 301 y 401) y **dos de los tres están bien tecleados**: con más de una
    // lectura mala, la suma de los otros medidores se descoloca para todos y
    // señalar a uno manda a mirar al sitio equivocado. Por eso se calla.
    for (const [dpto, valor] of Object.entries({ ...JULIO, '101': '184661', '201': '175256' })) {
      await page.getByRole('button', { name: new RegExp(`^${dpto}\\b`) }).first().click()
      await teclear(page, `${valor.slice(0, -3)}.${valor.slice(-3)}`)
    }
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /Consumo de agua del edificio/ }).click()
    await teclear(page, '81')

    await expect(page.getByRole('heading', { name: 'La factura de agua' })).toBeVisible()
    await expect(page.locator('[data-propuesta]')).toHaveCount(0)
  })

  test('con una lectura que no cuadra, el paso 6 bloquea la publicación', async ({ page }) => {
    // Se escriben las siete lecturas, pero una con el medidor retrocedido: eso
    // da un consumo negativo, que el tercer cuadre detecta.
    await abrirCierre(page)
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()
    for (const [dpto, valor] of Object.entries(JULIO)) {
      await page.getByRole('button', { name: new RegExp(`^${dpto}\\b`) }).first().click()
      await teclear(page, dpto === '101' ? '1.000' : `${valor.slice(0, -3)}.${valor.slice(-3)}`)
    }
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /Consumo de agua del edificio/ }).click()
    await teclear(page, '81')
    await page.getByRole('button', { name: /Monto de la factura de agua/ }).click()
    await teclear(page, '338.60')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /Monto del recibo de luz común/ }).click()
    await teclear(page, '361.20')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Confirmar y seguir' }).click()
    await page.getByRole('button', { name: /Nada más este mes, seguir|Continuar/ }).click()

    // Paso 6: no cuadra, y el botón dice qué revisar en vez de ponerse gris.
    await expect(page.getByText('Los montos no cuadran')).toBeVisible()
    await expect(page.getByText('Revisa la factura para seguir')).toBeVisible()

    // Y aunque se llame a la API directamente, tampoco publica.
    const r = await page.request.post('/api/meses/2026-07/publicar', {
      data: {
        notaQuePaso: 'x',
        notaQueCambio: 'x',
        notaQuePendiente: 'x',
        version: await versionDe(page, '2026-07'),
      },
    })
    expect(r.status()).toBe(409)
    expect((await r.json()).error).toContain('no cuadra')
  })

  test('publicar dos veces falla limpiamente', async ({ page }) => {
    // Junio ya está publicado en la semilla.
    const r = await page.request.post('/api/meses/2026-06/publicar', {
      data: {
        notaQuePaso: 'x',
        notaQueCambio: 'x',
        notaQuePendiente: 'x',
        version: await versionDe(page, '2026-06'),
      },
    })
    expect(r.status()).toBe(409)
    expect((await r.json()).error).toContain('ya estaba publicado')
  })

  test('desmarcar el lavado: el 401 paga menos y el total del mes no cambia', async ({ page }) => {
    const antes = await (await page.request.get('/api/meses/2026-06')).json()
    expect(antes.resultado.lavado).toBe(1.5)

    // La semilla deja julio vacío: se cargan sus datos como haría el cierre.
    for (const [dpto, valor] of Object.entries(JULIO)) {
      const r = await page.request.put('/api/meses/2026-07/lecturas', {
        data: {
          lecturas: { [dpto]: Number(`${valor.slice(0, -3)}.${valor.slice(-3)}`) },
          version: await versionDe(page, '2026-07'),
        },
      })
      expect(r.ok(), `guardar la lectura del ${dpto}`).toBeTruthy()
    }
    const rec = await page.request.put('/api/meses/2026-07/recibo', {
      data: { aguaM3: 81, aguaMonto: 338.6, luz: 361.2, version: await versionDe(page, '2026-07') },
    })
    expect(rec.ok()).toBeTruthy()

    const conLavado = await (await page.request.get('/api/meses/2026-07')).json()
    expect(conLavado.resultado.lavado).toBe(1.5)
    const aguaConLavado = conLavado.resultado.cuotas['401'].agua

    const r = await page.request.put('/api/meses/2026-07/reasignaciones', {
      data: { activa: false, version: await versionDe(page, '2026-07') },
    })
    expect(r.ok()).toBeTruthy()

    const julio = await (await page.request.get('/api/meses/2026-07')).json()
    expect(julio.resultado.lavado).toBe(0)
    // El área común vuelve a repartirse entre los siete…
    expect(julio.resultado.comunReal).toBe(julio.resultado.brutoComun)
    // …el 401 paga menos…
    expect(julio.resultado.cuotas['401'].agua).toBeLessThan(aguaConLavado)
    // …y el total del mes NO cambia.
    expect(julio.resultado.totalMes).toBe(3374.38)
  })
})

/**
 * Tecleando rápido no se pierde un dígito.
 *
 * Esto no es una prueba de interfaz: una lectura de medidor con un dígito de
 * menos cambia el consumo y cambia la cuota, y no hay nada en pantalla que lo
 * delate, porque el número que queda también parece un número.
 *
 * El defecto era real y estaba en `Numpad`: cada pulsación leía el valor del
 * cierre en vez del más reciente, así que dos toques procesados antes de
 * repintar se comían uno. Salió en una corrida completa, con 438.038 donde se
 * había tecleado 483.038.
 */
test.describe('el teclado numérico aguanta dedos rápidos', () => {
  test('doce dígitos seguidos, sin esperar entre uno y otro, entran los doce', async ({ page }) => {
    await abrirCierre(page)
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()
    await page.getByRole('button', { name: /^401\b/ }).first().click()

    const visor = page.locator('.numpad-panel .numpad-numero')
    await expect(visor).toBeVisible()
    // Se borra lo que hubiera, también a toques seguidos.
    await page.evaluate(() => {
      const panel = document.querySelector('.numpad-panel')!
      const borrar = [...panel.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? '').trim() === 'Borrar',
      )!
      for (let i = 0; i < 12; i++) borrar.click()
    })
    await expect(visor, 'los borrados también se pierden si se pulsan rápido').toHaveText('0')

    await teclearRapido(page, '483038')
    await expect(visor, 'se perdió un dígito al teclear rápido').toHaveText('483038')
  })
})
