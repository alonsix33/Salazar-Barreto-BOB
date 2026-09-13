import ExcelJS from 'exceljs'
import { expect, test } from './basedatos'

/**
 * El resto del panel de administración: corregir un mes ya publicado y exportar
 * el año a Excel. Fase 5, puntos 7 y 9 del verificador.
 *
 * Los dos existen porque el prototipo **no** los resolvía: la hoja de exportar
 * estaba dibujada y la descarga no existía, y la corrección de un mes publicado
 * era una propuesta en memoria que se perdía al recargar.
 */

// Sin `mode: 'serial'`: cada test toma el cerrojo y resiembra, y en serie un
// fallo marca los siguientes como "did not run", que esconde huecos.

test.describe('el panel de administración', () => {
  test('corregir un mes publicado avisa a los siete con el antes y el después', async ({ page }) => {
    // La cuota del 202 antes de tocar nada, tal como la ve el vecino.
    const antes = await (await page.request.get('/api/meses/2026-06')).json()
    const cuotaAntes = antes.resultado.cuotas['202'].total as number

    await page.goto('/admin')
    await page.getByRole('button', { name: /Corregir/ }).click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()

    // Se cambia la lectura del 202: 35.112 → 35.500. El teclado abre con la
    // lectura actual puesta, así que primero se borra.
    await hoja.getByRole('button', { name: /^202\b/ }).click()
    for (let i = 0; i < 12; i++) {
      await page.getByRole('button', { name: 'Borrar', exact: true }).click()
    }
    for (const d of '35.500') {
      await page.getByRole('button', { name: d === '.' ? 'Punto decimal' : d, exact: true }).click()
    }
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(hoja.getByText('35.500')).toBeVisible()

    await hoja.getByRole('textbox').fill('Se había tecleado mal la lectura del 202.')
    await hoja.getByRole('button', { name: 'Guardar la corrección y avisar' }).click()

    // La cuota cambió de verdad, no solo en la pantalla del admin.
    await expect
      .poll(
        async () =>
          (await (await page.request.get('/api/meses/2026-06')).json()).resultado.cuotas['202']
            .total,
      )
      .not.toBe(cuotaAntes)
    const despues = await (await page.request.get('/api/meses/2026-06')).json()
    const cuotaDespues = despues.resultado.cuotas['202'].total as number

    // Y el aviso que ven los siete lleva el monto anterior y el nuevo.
    await page.goto('/avisos')
    const aviso = page.getByText(/corri/i).first()
    await expect(aviso).toBeVisible()
    const textoAvisos = await page.locator('main, body').first().innerText()
    expect(textoAvisos).toContain(cuotaAntes.toFixed(2))
    expect(textoAvisos).toContain(cuotaDespues.toFixed(2))
    expect(textoAvisos).toContain('Se había tecleado mal')
  })

  /**
   * Se puede corregir **cualquier** mes publicado, no solo el último.
   *
   * El botón decía «Corregir un mes publicado» —un artículo indefinido que
   * promete escoger— y la hoja abría siempre sobre el último. Mayo, que es el
   * mes que `04` usa de ejemplo («se corrigió la lectura del 202 en mayo»), era
   * inalcanzable.
   */
  test('se puede corregir un mes anterior al último publicado', async ({ page }) => {
    const antes = await (await page.request.get('/api/meses/2026-05')).json()
    const cuotaAntes = antes.resultado.cuotas['202'].total as number

    await page.goto('/admin')
    await page.getByRole('button', { name: /Corregir/ }).click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()

    // Se abre por el más reciente y se elige mayo.
    await expect(hoja.getByText('Corregir Junio 2026')).toBeVisible()
    await hoja.getByRole('button', { name: 'Mayo 2026' }).click()
    await expect(hoja.getByText('Corregir Mayo 2026')).toBeVisible()

    // La lectura del 202 en mayo es 27.264. Se baja a 27.200: el 202 consume
    // menos y el área común crece, que es el sentido seguro — subirla la mete en
    // negativo y el propio guardián de la corrección lo rechaza, con razón.
    await hoja.getByRole('button', { name: /^202\b/ }).click()
    for (let i = 0; i < 12; i++) {
      await page.getByRole('button', { name: 'Borrar', exact: true }).click()
    }
    for (const d of '27.200') {
      await page.getByRole('button', { name: d === '.' ? 'Punto decimal' : d, exact: true }).click()
    }
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await hoja.getByRole('textbox').fill('Se leyó mal el medidor del 202 en mayo.')
    await hoja.getByRole('button', { name: 'Guardar la corrección y avisar' }).click()

    await expect
      .poll(
        async () =>
          (await (await page.request.get('/api/meses/2026-05')).json()).resultado.cuotas['202']
            .total,
      )
      .not.toBe(cuotaAntes)

    // Y junio, que no se tocó, sigue igual.
    const junio = await (await page.request.get('/api/meses/2026-06')).json()
    expect(junio.resultado.valido).toBe(true)
  })

  test('el Excel se descarga de verdad y sus cifras son las de la app', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Exportar el año en Excel' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Descargar 2026 en Excel/ }).click(),
    ])
    expect(descarga.suggestedFilename()).toBe('edificio-salazar-barreto-2026.xlsx')

    const ruta = await descarga.path()
    const libro = new ExcelJS.Workbook()
    await libro.xlsx.readFile(ruta)
    // Que ExcelJS lo lea es la prueba de que es un .xlsx y no un HTML de error.
    expect(libro.worksheets.length).toBeGreaterThan(0)

    // Y que las cifras sean las mismas que sirve la app, **celda por celda**.
    //
    // Buscar cada cuota "en algún sitio del libro" no comprobaba nada: la hoja
    // de Pagos repite las mismas siete cifras, así que desviar la fila de Cuotas
    // en un céntimo seguía dando verde. Se comprueba la celda que toca en la
    // hoja que toca. Y números, no texto: la celda guarda 634.9 y la app pinta
    // "634.90".
    const junio = await (await page.request.get('/api/meses/2026-06')).json()
    const cuotas = libro.getWorksheet('Cuotas')
    expect(cuotas, 'el libro tiene que traer la hoja de Cuotas').toBeTruthy()

    // `row.values` viene con hueco en el índice 0 y `map` salta los huecos:
    // hay que materializarlo con `Array.from` o el primer `c` llega `undefined`.
    const cabecera = Array.from(cuotas!.getRow(1).values as unknown[], (v) => String(v ?? ''))
    const filaJunio = (() => {
      for (let i = 2; i <= cuotas!.rowCount; i++) {
        const fila = cuotas!.getRow(i)
        if (String(fila.getCell(1).value ?? '').toLowerCase().includes('junio')) return fila
      }
      return null
    })()
    expect(filaJunio, 'tiene que haber una fila de junio en Cuotas').not.toBeNull()

    const DPTOS = ['101', '201', '202', '301', '401', '501', '502'] as const
    for (const dpto of DPTOS) {
      const columna = cabecera.findIndex((c) => c.includes(dpto))
      expect(columna, `la hoja de Cuotas tiene que tener columna del ${dpto}`).toBeGreaterThan(0)
      const celda = filaJunio!.getCell(columna).value
      expect(celda, `la cuota del ${dpto} en la celda de junio`).toBeCloseTo(
        junio.resultado.cuotas[dpto].total as number,
        2,
      )
    }

    /**
     * Y trae **lo que la hoja de la app promete que trae**.
     *
     * Decía «las lecturas de medidor y los consumos» y no había ni una lectura,
     * y «las 7 cuotas con su desglose» sobre una pestaña que solo tenía totales.
     * Este archivo es lo que alguien abre para recalcular a mano.
     */
    const agua = libro.getWorksheet('Agua')
    expect(agua, 'la pestaña de Agua').toBeTruthy()
    const cabeceraAgua = Array.from(agua!.getRow(1).values as unknown[], (v) => String(v ?? ''))
    for (const dpto of DPTOS) {
      expect(cabeceraAgua, `las lecturas del ${dpto}`).toContain(`${dpto} lectura anterior`)
      expect(cabeceraAgua, `las lecturas del ${dpto}`).toContain(`${dpto} lectura actual`)
      expect(cabecera, `el desglose del ${dpto}`).toContain(`${dpto} mantenimiento`)
      expect(cabecera, `el desglose del ${dpto}`).toContain(`${dpto} agua`)
    }

    // Y la lectura que hay en la celda es la que sirve la app, no otra.
    const filaAguaJunio = (() => {
      for (let i = 2; i <= agua!.rowCount; i++) {
        const fila = agua!.getRow(i)
        if (String(fila.getCell(1).value ?? '').toLowerCase().includes('junio')) return fila
      }
      return null
    })()
    expect(filaAguaJunio).not.toBeNull()
    const col = cabeceraAgua.indexOf('401 lectura actual')
    expect(filaAguaJunio!.getCell(col).value).toBeCloseTo(
      junio.resultado.cuotas['401'].lecturaActual as number,
      3,
    )
  })
})

/**
 * Confirmar pagos de un mes anterior — la hoja que reutiliza `RegistrarPago`
 * para los siete departamentos de un mes ya publicado, confirmados o no.
 *
 * `RegistrarPago` solo recibía pagos en `'aviso'` o sin nada antes de esta
 * hoja: un pago ya `'confirmado'` es un camino nuevo, y dos defectos reales
 * vivían justo ahí. Los dos cubiertos aquí:
 *
 * 1. Sin la rama de `pago.estado === 'confirmado'`, la fila seguía ofreciendo
 *    el botón de confirmar sobre un pago que el servidor iba a rechazar —quien
 *    administraba lo tocaba, y recién ahí se enteraba de que ya estaba hecho.
 * 2. Con la rama puesta pero el subtítulo de dos vías sin actualizar, una fila
 *    confirmada mostraba "toca para registrar el pago" justo encima del aviso
 *    verde que dice lo contrario.
 */
test.describe('confirmar pagos de un mes anterior', () => {
  test('un pago ya confirmado no ofrece confirmarlo otra vez, ni dice que falta', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: /Confirmar pagos de un mes anterior/ }).click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()

    // 401 ya está confirmado en la semilla de 2026-06, el mes que abre por
    // defecto (el más reciente publicado).
    const fila401 = hoja.locator('.admin-pago', { hasText: '401' })
    await expect(fila401.getByText(/^Confirmado el/)).toBeVisible()
    await expect(fila401.getByText('toca para registrar el pago')).toHaveCount(0)
    await expect(
      fila401.getByRole('button', { name: /Confirmar contra el estado de cuenta/ }),
    ).toHaveCount(0)
  })

  test('confirmar un pago actualiza la fila al toque, sin que haga falta un segundo toque', async ({
    page,
  }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: /Confirmar pagos de un mes anterior/ }).click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()

    // 501 no tiene pago en junio de 2026 (`null` en la semilla): ni aviso, ni
    // confirmación.
    const fila501 = hoja.locator('.admin-pago', { hasText: '501' })
    await expect(fila501.getByText('toca para registrar el pago')).toBeVisible()
    await fila501.getByRole('button', { name: /Confirmar contra el estado de cuenta/ }).click()

    // `router.refresh()` no invalida la caché de React Query con la que esta
    // hoja trae sus datos: sin `invalidateQueries(['mes', mes])`, la fila se
    // quedaba con el botón de confirmar hasta un segundo toque, que era
    // cuando el servidor por fin decía "ese pago ya estaba confirmado".
    await expect(fila501.getByText(/^Confirmado el/)).toBeVisible()
    await expect(
      fila501.getByRole('button', { name: /Confirmar contra el estado de cuenta/ }),
    ).toHaveCount(0)
  })
})

/**
 * El teclado del PIN, con dedos rápidos.
 *
 * Mismo defecto que el numpad del cierre y de la misma familia: la pulsación
 * leía el PIN del cierre en vez del más reciente, así que dos toques seguidos
 * se comían uno. Aquí duele más que en una lectura de medidor, porque el PIN
 * correcto simplemente no entra y no hay nada en pantalla que diga por qué.
 */
test.describe('el teclado del PIN aguanta dedos rápidos', () => {
  /**
   * La sesión de administración se abre sola en estos tests, así que la pantalla
   * del PIN no se ve nunca. Aquí se cierra a propósito, que es lo único que la
   * hace aparecer.
   */
  const sinSesion = async (page: import('@playwright/test').Page) => {
    await page.goto('/')
    await page.request.delete('/api/admin/pin')
    await page.goto('/admin')
    await expect(page.locator('.pin-rejilla')).toBeVisible()
  }

  test('cuatro dígitos seguidos entran los cuatro', async ({ page }) => {
    await sinSesion(page)

    // Se teclea un PIN incorrecto a propósito: lo que se mide es cuántos
    // dígitos registró, no si entra.
    await page.evaluate(() => {
      const teclas = [...document.querySelectorAll('.pin-rejilla button')]
      for (const d of ['9', '9', '9', '9']) {
        const b = teclas.find((t) => (t.getAttribute('aria-label') ?? '').trim() === d)
        if (!b) throw new Error(`no existe la tecla ${d}`)
        ;(b as HTMLElement).click()
      }
    })

    // Los cuatro puntos llenos, o el anuncio del lector de pantalla diciendo 4.
    await expect(
      page.locator('.pin-punto-lleno'),
      'se perdió un dígito del PIN al teclear rápido',
    ).toHaveCount(4)
  })

  test('los borrados rápidos también cuentan todos', async ({ page }) => {
    await sinSesion(page)
    await page.evaluate(() => {
      const teclas = [...document.querySelectorAll('.pin-rejilla button')]
      const pulsa = (etiqueta: string) => {
        const b = teclas.find((t) => (t.getAttribute('aria-label') ?? '').trim() === etiqueta)
        ;(b as HTMLElement).click()
      }
      for (const d of ['1', '2', '3']) pulsa(d)
      for (let i = 0; i < 3; i++) pulsa('Borrar')
    })
    await expect(page.locator('.pin-punto-lleno'), 'un borrado se perdió').toHaveCount(0)
  })
})
