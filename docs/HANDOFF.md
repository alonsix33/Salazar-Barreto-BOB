# Handoff · continuar este proyecto

> **Si vas a seguir trabajando en esta aplicación, empieza por aquí.**
>
> Este documento existe para que quien llegue —persona o sesión nueva de
> Claude— pueda retomar sin perder nada: qué está hecho, qué está decidido y por
> qué, dónde están las trampas, y qué queda abierto.
>
> Es autocontenido. No hace falta haber leído la conversación en la que se
> construyó.

**Fecha:** 13 de septiembre de 2026
**Estado:** en producción, funcionando, con los siete vecinos usándola.

---

## Índice

1. [Qué es esto, en un párrafo](#1-qué-es-esto-en-un-párrafo)
2. [Estado exacto hoy](#2-estado-exacto-hoy)
3. [Cómo se construyó](#3-cómo-se-construyó)
4. [Cómo se trabaja en este repositorio](#4-cómo-se-trabaja-en-este-repositorio)
5. [Decisiones cerradas · no las reabras](#5-decisiones-cerradas--no-las-reabras)
6. [La arquitectura, y por qué es así](#6-la-arquitectura-y-por-qué-es-así)
7. [Catálogo de defectos que ya pasaron](#7-catálogo-de-defectos-que-ya-pasaron)
8. [Lo que queda abierto](#8-lo-que-queda-abierto)
9. [Tu primer día](#9-tu-primer-día)

---

## 1. Qué es esto, en un párrafo

Un edificio de siete departamentos en Lima (Jr. Enrique Salazar Barreto) que se
administra solo, sin administradora contratada. Uno de los vecinos cierra el mes:
toma las siete lecturas de los medidores de agua, mete la factura de SEDAPAL y el
recibo de luz, revisa los gastos fijos, y publica. Los otros seis abren la app,
ven cuánto les toca, pagan y avisan. Quien administra verifica los pagos contra
el estado de cuenta del banco.

La app es una PWA: se instala en el teléfono y funciona como una aplicación.

El proyecto nació de un **encargo de diseño completo**
(`mockup/design_handoff_edificio_salazar_barreto/`) con las reglas de negocio,
el sistema de diseño, las pantallas y los textos ya definidos. El código de
producción se construyó en diez fases contra ese encargo, y **el encargo sigue
siendo la fuente de verdad**: cuando el código y un documento discrepen, mandan
los del `mockup/`.

---

## 2. Estado exacto hoy

### Dónde vive

| | |
|---|---|
| App | Vercel · <https://salazar-barreto-bob.vercel.app> |
| Base de datos | Railway · PostgreSQL 16 |
| Código | GitHub · `TheLabReset/Salazar-Barreto-BOB`, rama `main` |
| Modelo de Bob | DeepSeek (`deepseek-flash`) |

### Qué hay cargado

**En producción:** ocho meses publicados con datos reales del edificio,
reconciliados contra el Excel que llevaba la administración anterior y contra el
chat de WhatsApp de los vecinos.

**En local**, `npm run db:seed` deja otra cosa: seis meses publicados (enero a
junio de 2026), julio a medias para que tengas un cierre que terminar, y
diciembre de 2025 como mes base, que no se publica nunca y existe solo para
darle a enero su lectura anterior. No confundas las dos: una cifra que veas en
tu máquina no tiene por qué ser la de producción. La carga se hizo con un SQL idempotente entregado aparte —**no está en
el repositorio a propósito**, porque lleva los datos bancarios de la cuenta
conjunta—.

### Rendimiento medido, en producción

| ruta | antes de septiembre | hoy |
|---|---|---|
| `/` | 12.2 – 12.9 s | 0.9 – 1.2 s |
| `/historial` | 39.4 s | 0.19 – 0.27 s |
| `/mi-departamento` | 30.4 – 31.9 s | 0.20 – 0.38 s |
| `/avisos` | 0.6 – 0.8 s | 0.52 – 0.57 s |

Por qué iba lento y qué se hizo: [`RENDIMIENTO.md`](RENDIMIENTO.md).

### Salud del código

| | |
|---|---|
| Tests de unidad | **502 ✓** (`npm run verify`, que además revisa tipos, tokens y documentos) |
| Tests de integración | **197 ✓** (contra Postgres) |
| Tests de extremo a extremo | **167 ✓** (Playwright) |
| Defectos inyectados que la suite detecta | **35 de 35** |
| Tokens de diseño huérfanos | **0**, sobre 237 ficheros |
| Secretos en el bundle del cliente | **0** |
| Migraciones de Prisma | 9, todas aplicadas |

### Dos ajustes pendientes del lado de quien despliega

Ninguno bloquea nada, pero el primero se nota:

1. **`?connection_limit=5`** al final de `DATABASE_URL` en Vercel. Hoy está en
   `=1`, que serializa las consultas que la app lanza a la vez. Es lo que explica
   que `/` tarde 0.9 s y `/historial` 0.2 s: Inicio es la que paga esa cola.
2. **Misma región** en Railway y Vercel. Comprobación de un minuto; si ya
   coinciden, no hay nada que hacer.

Los dos están explicados en [`DESPLIEGUE.md` §«Que no se ponga lenta»](DESPLIEGUE.md#que-no-se-ponga-lenta).

---

## 3. Cómo se construyó

Diez fases, cada una cerrada con verificación adversarial antes de pasar a la
siguiente. Cada fase dejó su documento:

| Fase | Qué se hizo | Verificación |
|---|---|---|
| 0 | Lectura del encargo y plan | [`verificacion-0.md`](verificacion-0.md) · [`PLAN.md`](PLAN.md) |
| 1 | El motor de cálculo, puro y probado | [`verificacion-1.md`](verificacion-1.md) |
| 2 | Tokens de diseño y su verificador | [`verificacion-2.md`](verificacion-2.md) |
| 3 | Base de datos y backend | [`verificacion-3.md`](verificacion-3.md) |
| 4 | Las pantallas del vecino | [`verificacion-4.md`](verificacion-4.md) |
| 5 | El cierre del mes y el panel | [`verificacion-5.md`](verificacion-5.md) |
| 6 | PWA, responsive, accesibilidad | [`verificacion-6.md`](verificacion-6.md) |
| 7 | Despliegue y CI | [`verificacion-7.md`](verificacion-7.md) |
| 8 | Bob | [`verificacion-8.md`](verificacion-8.md) · [`BOB-APARICIONES.md`](BOB-APARICIONES.md) |
| 9 | Auditoría final adversaria | [`AUDITORIA-FINAL.md`](AUDITORIA-FINAL.md) |

Después de las diez fases vino una tanda larga de trabajo sobre datos reales y
producción, que está registrada en [`CAMBIOS-DATOS-REALES.md`](CAMBIOS-DATOS-REALES.md)
y [`RENDIMIENTO.md`](RENDIMIENTO.md).

Esos documentos **no son decorativos**. Dicen qué quedó verificado, qué quedó
fuera y por qué. Si vas a tocar una zona, lee su verificación primero: te ahorra
redescubrir por qué algo está como está.

---

## 4. Cómo se trabaja en este repositorio

El método está en [`CLAUDE.md`](../CLAUDE.md), que es lo que una sesión de Claude
Code carga automáticamente. Lo esencial, por si llegas de otra forma:

### El principio

**Lo verde no es evidencia.** Casi todos los defectos graves de este repositorio
pasaron por un build exitoso, una suite en verde y un lint callado.

### Las tres prácticas que más han rendido

1. **Verificar ejecutando, no leyendo.** Correr el código en vez de revisarlo,
   recalcular la cifra desde la fuente cruda en vez de confiar en la que se ve.

2. **La prueba negativa, obligatoria.** Después de escribir cualquier chequeo,
   reintroducir a propósito el defecto que dice atrapar y confirmar que da rojo.
   `scripts/prueba-negativa.mjs` y `scripts/prueba-negativa-integracion.mjs`
   hacen eso automáticamente con 35 defectos reales.

   > Esto no es ceremonial. La duplicación de la regla del lavado —§7, defecto
   > 11— la destapó exactamente esto: **las 699 pruebas seguían en verde**, y lo
   > único que cambió fue que una inyección que llevaba meses poniéndose roja
   > dejó de detectarse.

3. **Verificadores adversariales.** Al cerrar una zona grande, soltar varios
   revisores en paralelo, de solo lectura, con ángulos que se solapen poco, y con
   un encargo explícito: **su trabajo no es confirmar que funciona, es encontrar
   dónde miente**. La diferencia entre esas dos misiones es la diferencia entre
   un informe vacío y uno con doce defectos.

### Al cerrar

Decir el estado real. Si ocho de nueve chequeos están en verde, decir *ocho de
nueve* y por qué el noveno no lo está. Y al final: **bajo qué condición esto
estaría equivocado, y cuál sería la señal temprana.**

---

## 5. Decisiones cerradas · no las reabras

Estas las tomó el usuario, o salieron de una auditoría con evidencia. Cambiarlas
necesita que él lo pida.

### De producto

| Decisión | Por qué |
|---|---|
| **No hay roles ni usuarios.** | Son siete vecinos que se conocen. Cualquiera entra a administración con el PIN. Un sistema de cuentas sería fricción sin beneficio. |
| **No hay layout de dos columnas en escritorio.** | La app es un marco de 390 px centrado, también en pantalla grande. Es una app de teléfono, y en escritorio se ve como tal. |
| **Teclado numérico propio**, no el del sistema. | Control total sobre el formato de las cifras. Donde se escribe texto libre —un comentario, un mensaje a Bob— sí va el teclado alfanumérico. |
| **Ningún rojo en un estado de pago.** Ni la palabra «deuda». | Son vecinos, no morosos. Lo pendiente se dice en ámbar y en suave. |
| **Bob no es un quinto destino de la navegación.** | Es una acción, y por eso su círculo está fuera de la píldora de navegación. |

### De arquitectura

| Decisión | Por qué |
|---|---|
| **No se guarda ninguna cuota calculada.** | Una cuota guardada se queda vieja cuando se corrige una entrada, y nadie se entera. Única excepción: `Cierre.instantanea`, que existe solo para que el aviso «pasó de X a Y» sea verificable. |
| **Nunca `Float`.** | Es dinero de siete familias. Todo `Decimal`, y la frontera a `number` vive en un solo fichero. |
| **El motor es puro.** | Sin Prisma, sin React. Por eso se puede probar con millones de combinaciones hostiles sin levantar nada. |
| **Reparto por resto mayor (Hamilton).** | Es lo que hace que los céntimos cuadren exactamente contra el total. |
| **La caché se invalida desde la extensión de Prisma**, no servicio por servicio. | Basta olvidarlo en un servicio para que un vecino vea una cuota vieja sin que nada se ponga rojo. Un único punto de paso que no se puede olvidar. |
| **Las pantallas de administración leen sin caché.** | Quien cierra el mes acaba de teclear y tiene que ver lo suyo al instante. |

### Del proceso

- **`mockup/**/support.js` no se mira y no se porta.** Lo dice el encargo.
- Los datos bancarios del edificio **no entran al repositorio**.
- Los flats de los siete departamentos **no se cambian sin documento**: salen de
  la escritura del edificio. Hay un test candado (`flat-candado.test.ts`) que
  compara los de la base contra los del código.

---

## 6. La arquitectura, y por qué es así

### Las cuatro capas

```
  components/        La interfaz. No sabe de Prisma.
       ▲
  app/               Rutas de Next: pantallas (Server Components) y API.
       ▲
  lib/servicios/     Escribir: transacciones, auditoría, avisos, bloqueo.
  lib/datos/         Leer: de Postgres al motor.
       ▲
  lib/calculo/       El motor. Puro. No sabe de nada de lo de arriba.
```

La regla es que las flechas **solo van hacia arriba**. El motor no importa
Prisma; los componentes no importan `lib/datos`.

### Los dos caminos de lectura, y por qué son dos

```
  Pantallas de vecino          Transacciones (cierre, corrección)
         │                                │
         ▼                                ▼
   almanaque()                    entradasDeMes(mes, tx)
   · las 7 tablas de una vez      · lee dentro de la transacción
   · cacheado hasta que           · ve lo que se acaba de escribir
     alguien escriba                y todavía no está confirmado
         │                                │
         └────────► lib/datos/filas.ts ◄──┘
                    LA MISMA REGLA
```

Hacen falta los dos: quien corrige un mes tiene que recalcular con lo que acaba
de escribir, y eso no se ve desde fuera de la transacción. Lo que **no** puede
haber es dos copias de la regla. Ya pasó dos veces (§7).

### La caché, en tres piezas

1. **`unstable_cache`** guarda la foto del edificio entre peticiones.
2. **La extensión de Prisma** (`lib/datos/prisma.ts`) la tira en **cualquier**
   operación de escritura. Es el único sitio donde eso ocurre.
3. **`responder()`** repite la invalidación después del commit, porque la de la
   extensión ocurre *dentro* de la transacción y entre las dos hay una rendija.

Más un `revalidate` de 300 s como red de seguridad, por si alguien escribe en la
base por fuera de la app —desde la consola de Railway, por ejemplo—.

### Bob, y sus cinco guardas

Bob funciona con o sin modelo, y la interfaz es la misma. **La clave manda:** con
`DEEPSEEK_API_KEY` usa el modelo; sin ella, un catálogo escrito a mano. El freno
de mano explícito es `BOB_SIN_MODELO`.

Las cinco guardas viven en el código, **no en el prompt**, y se aplican pase lo
que pase:

1. Dos frases como máximo.
2. No puede escribir: sus herramientas solo importan lectores, con un test que lo
   comprueba.
3. **Ninguna cifra inventada.** Un número que no salió de una herramienta llamada
   en esa conversación descarta la respuesta entera.
4. Todo queda registrado en `ConsultaBob`.
5. Ocho segundos de plazo; pasados, contesta el catálogo.

Bob **sí** puede hacer cuentas simples derivadas de las cifras que ya tiene
—cuántos días lleva alguien sin pagar, qué porcentaje representa un gasto—. Lo
que no puede es traerse un número de la nada.

---

## 7. Catálogo de defectos que ya pasaron

**Esta es la sección más útil del documento.** Son defectos reales, con su
síntoma, su causa y el chequeo que los cierra. Sirven para dos cosas: reconocer
una familia conocida, y calibrar a un verificador adversarial —cuéntale dos o
tres de estos y sus informes suben de calidad muchísimo—.

Todos **pasaron por una suite en verde**.

| # | Síntoma | Causa | Qué lo cierra |
|---|---|---|---|
| 1 | La cuota del 401 en un mes **ya publicado y avisado** se movía S/ 6.25 al cambiar el consumo del lavado | Los m³ vivían en un campo global; el marcador por mes solo guardaba un booleano | `ReasignacionActivaEnMes.m3` congela el valor al publicar · `lavado-no-reescribe-el-pasado.test.ts` |
| 2 | El aviso a los siete —«tu cuota pasó de X a Y»— citaba una Y que la app no cobraba | `corregirMes` tenía **su propia copia** de `entradasDeMes` y las dos se separaron | Una sola calculadora, y se le pasa el cliente · inyección en la prueba negativa |
| 3 | El saldo daba un salto de miles de soles en cuanto el paso 2 guardaba el recibo del mes en curso | `serieDelSaldo` usaba los meses **con recibo** en vez de los **publicados** | `mesesPublicados()` · `auditoria-y-avisos.test.ts` |
| 4 | Un doble toque en el botón de publicar publicaba dos veces: dos apuntes de auditoría y el aviso duplicado a los siete | Leer-comparar-escribir en vez de un `WHERE publicado = false` | `updateMany` con la condición en el `WHERE` · inyección «dejar publicar dos veces» |
| 5 | El límite de intentos del PIN **no se activaba nunca** rotando la cabecera `x-forwarded-for`: los diez mil PINes al alcance | Se tomaba el primer elemento de la cabecera, que lo pone el cliente | `x-real-ip` primero, y un tope global además del de por IP · **dos** inyecciones, una por tope |
| 6 | La casilla rotulada ENE mostraba febrero a partir de la publicación número trece | La tira de doce meses se llenaba por posición con «los últimos doce publicados» | `vistaAnual` reindexa por mes de calendario · `vista-anual.test.ts` |
| 7 | Un rebuild figuró con check verde y **no reconstruyó nada** | Murió en la última línea, el paso tenía `continue-on-error` y el de reporte salía con 0 | Buscar el artefacto, no el estado |
| 8 | La app entera dejó de abrir en producción: pantalla en negro | El service worker hacía `throw` desde `respondWith` con una red lenta | Nunca rechazar la promesa de `respondWith` · test con `setOffline` |
| 9 | El teclado numérico perdía dígitos con dedos rápidos: 483.038 salía 438.038 | `setValor(valor + d)` en vez del actualizador funcional | `setValor(v => v + d)` · e2e de doce dígitos seguidos |
| 10 | Bob llevaba semanas contestando con el catálogo en producción | Hacían falta **dos** variables de acuerdo y solo estaba una | La clave manda · `lib/bob/__tests__/modo.test.ts` · y el panel enseña el modo |
| 11 | **Ninguno.** Todo verde | La regla del lavado se duplicó al montar la foto del edificio | Una sola regla en `lib/datos/filas.ts` · lo destapó la prueba negativa, no un test |
| 12 | Un esqueleto de carga aparecía y acto seguido navegaba a otro sitio | `loading.tsx` en la raíz cubría también `/mes`, que solo redirige | Grupo de rutas `(inicio)` · lo cazó el e2e de accesibilidad, y no por lo que comprueba |

### Los patrones, que es lo que se repite

- **Dos copias de la misma regla que se separan.** Nº 2 y nº 11. Es el más caro
  de este repositorio y el más difícil de ver: el día que se escriben, las dos
  copias dicen lo mismo.
- **Un chequeo que no prueba lo que dice.** El nº 7, y el chequeo de invalidación
  de caché que se escribió y se tiró porque daba verde con la invalidación
  arrancada de raíz (§6 de `RENDIMIENTO.md`).
- **Una medición hecha sobre el objeto equivocado.** Medir producción sin la
  cookie de sesión mide el onboarding, que no toca la base.
- **Un síntoma que no se parece a la causa.** Nº 12: el fallo salió como «no se
  puede inyectar un estilo» en un test de accesibilidad.

---

## 8. Lo que queda abierto

Nada de esto bloquea el uso diario.

### Datos

- **El pozo a tierra está en `null`**, que significa *por confirmar*, no *cuesta
  cero*. Espera el monto real. Aparece en la lista de gastos con su etiqueta y
  suma 0.
- **El 501 arrastra −0.06 de balance.** Sale de que el pago de agosto se
  registró como «665.1» en el chat de WhatsApp mientras su cuota exacta era
  665.16. Son seis céntimos y están declarados: no es un error de cálculo.

### Producto, ideas no comprometidas

- Dominio propio en vez de `algo.vercel.app`.
- Exportar el año a Excel ya existe; falta un resumen anual por departamento.
- Bob todavía no puede proponer el cierre completo de un mes; solo acompaña.

### Técnico

- Los dos ajustes de despliegue de §2.
- La foto del edificio trae **todas** las filas de todas las tablas. Con siete
  departamentos y una docena de meses son unas 300 filas y va sobrado; a
  cincuenta meses sigue yendo bien; a mil meses habría que paginar. La señal
  temprana es el tiempo de la primera petición tras escribir dejando de ser
  ~40 ms.

---

## 9. Tu primer día

En este orden:

1. **Lee el [`README.md`](../README.md)** entero. Son diez minutos y te da el
   mapa.
2. **Lee [`CLAUDE.md`](../CLAUDE.md)**, sobre todo §2 (las reglas que no se
   negocian) y §5 (las trampas del entorno).
3. **Arranca la app en local** con los cinco comandos del README §2 y haz un
   cierre de mes completo en `/admin`. Es la forma más rápida de entender el
   producto.
4. **Corre la puerta entera** para ver de dónde partes:

   ```bash
   npm run verify && npm run test:integracion
   ```

5. **Lee la §7 de este documento**, el catálogo de defectos. Es lo que te va a
   evitar repetir uno.
6. Cuando toques una zona, **lee su `docs/verificacion-<n>.md`** antes. Dice qué se
   comprobó y qué quedó fuera.

### Si lo que vas a hacer toca cifras

Entonces vas a tocar lo caro. Antes de dar nada por terminado:

```bash
npm run verify
npm run test:integracion
npm run test:e2e
npm run prueba-negativa                        # ~25 min, lánzalo en segundo plano
node scripts/prueba-negativa-integracion.mjs   # ~25 min
```

Y cruza a mano tres cifras contra la fuente cruda, con una calculadora aparte. No
es paranoia: es que el costo de un error aquí es una factura equivocada a siete
familias, y el de buscarlo es media hora.
