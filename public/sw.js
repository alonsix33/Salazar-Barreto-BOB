/*
 * El service worker. Fase 6, punto 2.
 *
 * Regla que gobierna todo lo de aquí: **no inventar datos, y no callarse**. Sin
 * conexión la app abre y enseña lo último que se guardó en este teléfono, **y lo
 * dice**. Lo que no hace nunca es rellenar un hueco con datos de ejemplo, con
 * ceros o con la respuesta de otro mes; y lo que tampoco hace es servir una
 * cifra de hace tres semanas con la misma cara que una de ahora.
 *
 * Tres cachés, con vidas distintas:
 *  - `shell`   · el armazón: las seis pantallas y los iconos. Se llena al instalar.
 *  - `datos`   · la última respuesta GET de cada consulta de la API.
 *  - `estatico`· los ficheros con huella de Next (`/_next/static/...`), inmutables.
 *
 * Y una cosa que **no** hace: guardar escrituras. Un PUT o un POST sin conexión
 * falla, y falla a la vista. Encolar en silencio el cierre de un mes para
 * mandarlo "cuando vuelva la señal" es la clase de magia que acaba publicando
 * dos veces o publicando datos viejos encima de los nuevos.
 */

/**
 * La versión sale de la URL con la que se registró (`/sw.js?v=…`), y el sello lo
 * pone el build.
 *
 * Estaba tecleada a mano —`'v1'`— y no cambiaba nunca. Dos consecuencias, las
 * dos medidas: el fichero era idéntico entre despliegues, así que el navegador
 * **nunca veía un service worker nuevo** y `activate` no volvía a correr; y la
 * limpieza de `activate`, que borra las cachés cuyo nombre no esté en la lista,
 * no podía borrar nada porque el nombre era siempre el mismo. Los chunks de cada
 * despliegue se acumulaban sobre los del anterior, sin techo.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'sin-sello'
const SHELL = `shell-${VERSION}`
const DATOS = `datos-${VERSION}`
const ESTATICO = `estatico-${VERSION}`
const NUESTRAS = [SHELL, DATOS, ESTATICO]

/** Lo estático, que es lo único que se precarga al instalar. */
const ICONOS = [
  '/iconos/icono-192.png',
  '/iconos/icono-512.png',
  '/iconos/apple-touch-icon.png',
  '/manifest.webmanifest',
]

/**
 * Cuánto se espera a la red antes de tirar de lo guardado.
 *
 * Sin plazo, la estrategia "red primero" solo funciona cuando la red **falla
 * rápido**. Con señal de una raya —el servidor acepta la conexión y no
 * contesta— la promesa de "abre sin conexión" no se cumplía: medido, veinticinco
 * segundos mirando una pantalla en blanco con la copia entera guardada al lado.
 * Y sin aviso, porque el teléfono seguía "conectado".
 *
 * Tres segundos: por encima de eso, para alguien de pie en el ascensor, la app
 * ya está rota. La red no se cancela — sigue en marcha y refresca la caché
 * cuando llegue.
 */
const PLAZO_MS = 3000

/**
 * El plazo de cada pieza del precacheado, más generoso.
 *
 * Aquí no hay nadie esperando delante de una pantalla: se está llenando la caché
 * en segundo plano. Lo único que no puede pasar es que se quede colgado.
 */
const PLAZO_INSTALL_MS = 8000

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    (async () => {
      /**
       * **Al instalar solo se guardan los ficheros estáticos.**
       *
       * Las seis pantallas también se precargaban aquí, y era un error por dos
       * motivos. Uno medido: cada pantalla es una página dinámica que consulta
       * la base, así que pedirlas todas dejaba el `install` corriendo casi un
       * minuto y el service worker en `installing` mientras tanto —sin cachear
       * nada y sin servir nada—. Y uno de fondo: precargar `/` para alguien que
       * todavía no eligió departamento guarda el onboarding como si fuera su
       * pantalla de inicio.
       *
       * Las pantallas se guardan **cuando se visitan**, que es cuando ya se sabe
       * qué contienen y para quién. Lo hace el manejador de navegaciones.
       */
      const cache = await caches.open(SHELL)
      for (const ruta of ICONOS) {
        try {
          const r = await redConPlazo(new Request(ruta, { cache: 'reload' }), PLAZO_INSTALL_MS)
          if (sirveParaGuardar(r, ruta)) await guardar(cache, ruta, r)
        } catch {
          // Sin red, o tardando demasiado. Se llenará en la primera visita.
        }
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    (async () => {
      const nombres = await caches.keys()
      await Promise.all(nombres.filter((n) => !NUESTRAS.includes(n)).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

/** Cabecera con la que se le dice a la app cuándo se guardó lo que recibe. */
const CABECERA_FECHA = 'x-sb-guardado-en'
/** Cabecera con la que se marca que una respuesta sale de la caché. */
const CABECERA_CACHE = 'x-sb-desde-cache'

/**
 * ¿Esta respuesta se puede guardar?
 *
 * Tres motivos para decir que no, y los tres aparecieron de verdad:
 *
 *  1. **`Cache-Control: no-store`.** El servidor pidió que no se guardara y no se
 *     miraba en ningún sitio: el Excel del año, que va marcado `no-store`,
 *     acababa en la caché del teléfono.
 *  2. **Un `200` que no es la página.** Un portal cautivo del wifi contesta 200
 *     con su propio HTML, y eso se guardaba **encima** de la pantalla buena: a
 *     partir de ahí, la copia sin conexión del teléfono era la del portal. Se
 *     comprobó y salía «Acepta los términos del wifi del edificio» como pantalla
 *     de inicio. Con HTTPS un portal no puede suplantar el origen, pero el mismo
 *     agujero lo abre cualquier 200 que no sea lo esperado: un onboarding porque
 *     caducó la cookie, una página de mantenimiento.
 *  3. **Una redirección.** Si la respuesta viene de otra URL, no es la de esta.
 */
function sirveParaGuardar(respuesta, ruta, opciones = {}) {
  if (!respuesta.ok) return false
  if (respuesta.redirected) return false
  /**
   * El `no-store` se respeta en los datos y **no** en las pantallas.
   *
   * Next marca `private, no-cache, no-store` **todas** las páginas dinámicas, y
   * aquí lo son las seis. Respetarlo a rajatabla dejaba la caché vacía y la app
   * sin nada que enseñar sin conexión: la promesa entera de la Fase 6, muerta
   * por una cabecera que Next pone por rutina.
   *
   * La cabecera dice «no la sirvas como si fuera fresca», y eso se cumple: una
   * pantalla guardada solo sale cuando la red no llega, viene marcada
   * `x-sb-desde-cache`, y la app enseña el aviso con la fecha. Lo que sí se
   * respeta al pie de la letra es en los datos, donde el `no-store` lo pone el
   * servidor a propósito — el Excel del año, por ejemplo, que acababa en la
   * caché del teléfono sin que nadie lo hubiera pedido.
   */
  if (!opciones.esPantalla && /no-store/i.test(respuesta.headers.get('cache-control') || '')) {
    return false
  }
  try {
    if (new URL(respuesta.url || self.location.origin).origin !== self.location.origin) return false
  } catch {
    return false
  }
  // Una pantalla tiene que ser HTML. Un portal cautivo también manda HTML, pero
  // ya no puede llegar aquí: lo paran el origen y la redirección.
  if (opciones.esPantalla && !(respuesta.headers.get('content-type') || '').includes('text/html')) {
    return false
  }
  return true
}

/**
 * El prefijo con el que se apunta **cuándo** se guardó cada cosa.
 *
 * La fecha va como una entrada más **de la misma caché**, bajo una URL que no
 * existe. Dos cosas que parecían más limpias y no lo son:
 *
 *  - Meterla en una cabecera de la respuesta guardada obliga a reconstruir la
 *    `Response`, y eso obliga a leer el cuerpo. Con el original sin consumir, la
 *    lectura se queda esperando y **el `install` no termina nunca**.
 *  - Ponerla en una caché aparte obliga a un `caches.open` nuevo desde dentro
 *    del bucle de guardado. Medido: el `install` se quedaba en `installing` para
 *    siempre y la caché de fechas ni siquiera llegaba a crearse.
 *
 * Con el prefijo se reutiliza el mismo `cache` que ya está abierto y no se toca
 * ningún cuerpo.
 */
const PREFIJO_FECHA = '/__sb_guardado_en__'

/**
 * Guarda, apunta la fecha, y **sin dejar un rechazo suelto**.
 *
 * **Recibe la respuesta que se va a consumir aquí, no un clon de cortesía.**
 * `clone()` parte el flujo en dos, y si una de las dos ramas no se lee nunca, la
 * otra se queda esperando: guardando un clon cuyo original nadie consumía, el
 * `install` no terminaba jamás y el service worker se quedaba en `installing`
 * para siempre. Quien necesite quedarse con el original —el manejador de
 * `fetch`, que tiene que devolverlo— clona **antes** y manda el clon aquí; esa
 * rama sí se lee, porque se la devuelve al navegador.
 */
async function guardar(cache, peticion, respuesta) {
  try {
    await cache.put(peticion, respuesta)
    await cache.put(claveDeFecha(peticion), new Response(new Date().toISOString()))
  } catch {
    // Cuota llena, modo incógnito, almacenamiento bloqueado. Se sigue sirviendo
    // de la red; lo que no puede pasar es que un `put` rechazado tumbe la
    // petición del usuario o deje un rechazo sin capturar dentro del worker.
  }
}

/** La URL inventada bajo la que se apunta la fecha de esta petición. */
function claveDeFecha(peticion) {
  const url = typeof peticion === 'string' ? new URL(peticion, self.location.origin).href : peticion.url
  return `${PREFIJO_FECHA}?u=${encodeURIComponent(url)}`
}

/** Cuándo se guardó lo que hay en la caché para esta petición. */
async function fechaDe(peticion) {
  try {
    const r = await caches.match(claveDeFecha(peticion))
    return r ? await r.text() : null
  } catch {
    return null
  }
}

/** Marca una respuesta que sale de la caché, y avisa a las pantallas abiertas. */
async function desdeCache(respuesta, peticion) {
  const cabeceras = new Headers(respuesta.headers)
  cabeceras.set(CABECERA_CACHE, 'si')
  const guardadoEn = await fechaDe(peticion)
  if (guardadoEn) cabeceras.set(CABECERA_FECHA, guardadoEn)
  avisarALasPantallas(guardadoEn)
  // Aquí sí se puede reconstruir: el cuerpo viene de la caché y es de este uso.
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  })
}

/**
 * Le dice a la app que lo que acaba de recibir **es de la caché**.
 *
 * Sin esto, el aviso de "sin conexión" salía solo cuando `navigator.onLine` era
 * `false`, y eso mide si hay **interfaz de red**, no si hay servidor. Con wifi
 * conectado y sin salida —el router del edificio sin ruta, un portal cautivo,
 * los datos agotados— el vecino veía su cuota de hace semanas sin una sola marca
 * de que era vieja. Que es exactamente lo que esta app existe para evitar.
 */
function avisarALasPantallas(guardadoEn) {
  self.clients
    .matchAll({ type: 'window' })
    .then((clientes) => {
      for (const c of clientes) c.postMessage({ tipo: 'desde-cache', guardadoEn: guardadoEn || null })
    })
    .catch(() => {})
}

/** La red, pero sin esperar para siempre. */
function redConPlazo(peticion, plazoMs = PLAZO_MS) {
  return Promise.race([
    fetch(peticion),
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('plazo')), plazoMs)),
  ])
}

self.addEventListener('fetch', (ev) => {
  const peticion = ev.request
  const url = new URL(peticion.url)

  // Solo lo nuestro y solo GET. Todo lo demás va a la red tal cual: las
  // escrituras no se tocan, ni para guardarlas ni para reintentarlas.
  if (peticion.method !== 'GET' || url.origin !== self.location.origin) return

  // Los ficheros con huella de Next no cambian nunca: caché primero y ya.
  if (url.pathname.startsWith('/_next/static/')) {
    ev.respondWith(
      (async () => {
        const guardado = await caches.match(peticion)
        if (guardado) return guardado
        const r = await fetch(peticion)
        // Se clona **antes**: el original se devuelve al navegador, que lo lee,
        // así que las dos ramas del flujo se consumen y no hay bloqueo.
        if (sirveParaGuardar(r)) await guardar(await caches.open(ESTATICO), peticion, r.clone())
        return r
      })(),
    )
    return
  }

  // La API: red primero con plazo, y si no llega, lo último que se guardó.
  if (url.pathname.startsWith('/api/')) {
    // El PIN, el resembrado y **todo lo que exige sesión de administración** se
    // quedan fuera. `/api/meses/…/borrador` estaba dentro y no debía: son las
    // lecturas de un mes sin publicar, guardadas en el teléfono, sobreviviendo
    // al cierre de sesión —que borra la cookie, no la caché— y sirviéndole
    // estado viejo al asistente sin que el administrador lo note.
    if (
      url.pathname.startsWith('/api/admin/') ||
      url.pathname.startsWith('/api/pruebas/') ||
      url.pathname.endsWith('/borrador') ||
      url.pathname.startsWith('/api/export/')
    ) {
      return
    }
    ev.respondWith(
      (async () => {
        try {
          const r = await redConPlazo(peticion)
          if (sirveParaGuardar(r)) await guardar(await caches.open(DATOS), peticion, r.clone())
          return r
        } catch (error) {
          const guardado = await caches.match(peticion)
          if (guardado) return desdeCache(guardado, peticion)
          throw error
        }
      })(),
    )
    return
  }

  // Navegaciones: red primero con plazo, y si no llega, la pantalla guardada. Si
  // tampoco hay pantalla guardada, se deja que falle: el navegador enseña su
  // error, que es más honesto que una página nuestra fingiendo que la app va.
  if (peticion.mode === 'navigate') {
    ev.respondWith(
      (async () => {
        try {
          const r = await redConPlazo(peticion)
          if (sirveParaGuardar(r, url.pathname, { esPantalla: true })) {
            await guardar(await caches.open(SHELL), peticion, r.clone())
          }
          return r
        } catch (error) {
          const guardado = (await caches.match(peticion)) ?? (await caches.match('/'))
          if (guardado) return desdeCache(guardado, peticion)
          throw error
        }
      })(),
    )
  }
})

// ── Push · avisos del edificio · `06` §9.6.7 ────────────────────────────────
// El servidor manda { titulo, cuerpo, url }. Se muestra la notificación; al
// tocarla, se enfoca una pestaña abierta de la app o se abre una nueva en la url.
self.addEventListener('push', (ev) => {
  let datos = { titulo: 'Salazar Barreto', cuerpo: 'Hay novedades del edificio.', url: '/' }
  try {
    if (ev.data) datos = { ...datos, ...ev.data.json() }
  } catch {
    // Carga no-JSON: se queda el aviso por defecto.
  }
  ev.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: '/iconos/icono-192.png',
      badge: '/iconos/icono-192.png',
      data: { url: datos.url || '/' },
      tag: 'salazar-barreto',
    }),
  )
})

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close()
  const destino = new URL(ev.notification.data?.url || '/', self.location.origin).href
  ev.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const cliente of abiertas) {
        if (cliente.url === destino && 'focus' in cliente) return cliente.focus()
      }
      const uno = abiertas[0]
      if (uno && 'focus' in uno) {
        await uno.focus()
        if ('navigate' in uno) await uno.navigate(destino).catch(() => {})
        return
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino)
    })(),
  )
})
