# App del edificio · Jr. Enrique Salazar Barreto

Una aplicación web para que un edificio de **siete departamentos en Lima** se
administre solo: repartir los gastos del mes, cobrar, verificar los pagos y que
los siete vecinos vean en qué van las cuentas desde el teléfono.

No hay administradora contratada. Uno de los vecinos cierra el mes cada mes, y el
resto quiere abrir la app, ver cuánto le toca, pagar y no pensar más en eso.

**En producción:** <https://salazar-barreto-bob.vercel.app> · app en Vercel, base
en Railway.

---

## Índice

1. [El edificio en un minuto](#1-el-edificio-en-un-minuto)
2. [Arrancarlo en tu computadora](#2-arrancarlo-en-tu-computadora)
3. [El mapa del repositorio](#3-el-mapa-del-repositorio)
4. [Cómo se calcula un mes](#4-cómo-se-calcula-un-mes)
5. [Las cinco reglas que no se negocian](#5-las-cinco-reglas-que-no-se-negocian)
6. [Bob](#6-bob)
7. [Cómo se verifica que esto funciona](#7-cómo-se-verifica-que-esto-funciona)
8. [Todos los comandos](#8-todos-los-comandos)
9. [Dónde está cada documento](#9-dónde-está-cada-documento)
10. [Operar la app cada mes](#10-operar-la-app-cada-mes)

---

## 1. El edificio en un minuto

Siete departamentos, cada uno con su porcentaje de participación —su **flat**—
tomado de la escritura del edificio. Los siete suman exactamente 100.00.

| Dpto | Piso | Flat |
|---|---|---|
| 101 | 1 | 11.72 % |
| 201 | 2 | 10.21 % |
| 202 | 2 | 20.11 % |
| 301 | 3 | 10.21 % |
| 401 | 4 | 10.21 % |
| 501 | 5 | 17.31 % |
| 502 | 5 | 20.23 % |

Cada mes hay tres clases de gasto, y **se reparten distinto**:

- **Agua.** Cada departamento tiene medidor. Paga **su consumo real** al precio
  del m³ de ese mes, que sale de dividir la factura de SEDAPAL entre los m³ que
  facturó. Lo que el medidor matriz marca de más que la suma de los siete es
  **agua común**, y esa sí se reparte entre los siete por su flat.
- **Mantenimiento.** Luz común, guardianía, ascensor, mantenimientos anuales.
  Se reparte **por flat**.
- **Puntuales.** Un portón, una pintada. Se reparte por flat **entre quienes lo
  pagan**, renormalizando sus flats al nuevo 100 %: el portón del garaje no le
  sirve al primer piso, así que el 101 no entra.

Hay dos casos particulares que el código trata con nombre propio: el **lavado de
vehículo del 401** —m³ que se restan del área común y se le suman a él, sin que
cambie el total del edificio— y los **créditos**, que se descuentan de la cuota
de un departamento y salen del saldo de la cuenta conjunta, no del bolsillo de
los demás.

Las reglas completas, con sus fórmulas y sus casos borde, están en
[`mockup/design_handoff_edificio_salazar_barreto/01-reglas-de-negocio.md`](mockup/design_handoff_edificio_salazar_barreto/01-reglas-de-negocio.md).

---

## 2. Arrancarlo en tu computadora

Necesitas **Node 20 o más** y un **PostgreSQL 16** al que puedas apuntar.

```bash
git clone https://github.com/TheLabReset/Salazar-Barreto-BOB.git
cd Salazar-Barreto-BOB
npm ci

cp .env.example .env          # y rellena DATABASE_URL, DIRECT_URL, ADMIN_PIN, ADMIN_SECRETO
npm run db:migrate            # crea las tablas
npm run db:seed               # siembra los datos reales: enero a junio de 2026 publicados

npm run dev                   # http://localhost:3000
```

**Salió bien si** al abrir el navegador ves el onboarding —«¿Cuál es tu
departamento?»— y al elegir uno aparece la pantalla de Inicio con una cuota.

> La semilla deja **seis meses publicados** (enero a junio de 2026) y julio a
> medias, para que tengas un cierre que terminar. Diciembre de 2025 está ahí y
> **no se publica nunca**: existe solo para darle a enero su lectura anterior.
> Eso no es lo que hay en producción, que lleva ocho meses publicados cargados
> con los datos reales del edificio.

Para entrar al panel de administración: `/admin`, con el `ADMIN_PIN` que pusiste
en `.env`.

> **Las variables de entorno están explicadas una por una** —de dónde sale cada
> una y dónde va— en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md#tabla-de-claves--de-dónde-sale-cada-una-y-dónde-va).
> Solo cinco son obligatorias.

---

## 3. El mapa del repositorio

```
lib/calculo/     El motor. Puro, sin base de datos, sin React.
lib/datos/       Leer de Postgres y dárselo al motor.
lib/servicios/   Escribir. Transacciones, auditoría, avisos, bloqueo.
lib/bob/         El asistente: catálogo, modelo, guardas y herramientas.
app/             Rutas de Next: pantallas (Server Components) y API.
components/      La interfaz. `ui/` son las piezas, `pantallas/` las pantallas.
prisma/          Esquema, migraciones y semilla.
scripts/         Verificadores y pruebas negativas. No son utilidades: son puertas.
tests/           Integración (contra Postgres) y extremo a extremo (Playwright).
docs/            Cómo se construyó, cómo se despliega, qué se verificó.
mockup/          El encargo original. La fuente de verdad del diseño y las reglas.
```

### `lib/calculo/` · el motor

Puro: entra un `EntradasMes`, sale un `ResultadoMes`. No sabe de Prisma ni de
React, y por eso se puede probar a millones de combinaciones sin levantar nada.

| Fichero | Qué hace |
|---|---|
| `calcularMes.ts` | El cálculo entero de un mes: las siete cuotas, el total y los cuadres. |
| `reparto.ts` | Reparto por flat con **resto mayor** (Hamilton), para que los céntimos cuadren. |
| `redondeo.ts` | Dónde cae cada `Math.round`. No es cosmético: cambia el último céntimo. |
| `saldo.ts` | La cuenta conjunta mes a mes y el balance de cada departamento. |
| `sanidad.ts` | Lo que tiene que ser imposible: un porcentaje mayor a 100, una cuota negativa. |
| `correccion.ts` | Detecta dígitos transpuestos en una lectura y propone el arreglo. |
| `constantes.ts` | Los siete departamentos, sus flats y los conceptos de gasto. **Datos reales.** |

### `lib/datos/` · leer

| Fichero | Qué hace |
|---|---|
| `almanaque.ts` | **La foto del edificio.** Lee las siete tablas de una vez y calcula todos los meses en memoria. Es lo que hizo que la app pasara de 39 s a 0.2 s. |
| `filas.ts` | Las **reglas de lectura**, sobre filas ya en memoria: qué gasto fijo está vigente, cuántos m³ de lavado aplican. Una sola copia, la usan los dos caminos. |
| `mes.ts` | Leer un mes desde la base. Con `db` va contra la transacción; sin `db`, contra la foto. |
| `meses.ts` | Listas y agregados: el historial, la serie del saldo, el borrador del cierre. |
| `prisma.ts` | El cliente. Y la extensión que **invalida la caché en toda escritura**. |
| `decimal.ts` | La única frontera `Decimal ↔ number`. Un `.toNumber()` suelto en otro sitio es un bug. |

### `lib/servicios/` · escribir

Toda escritura pasa por aquí, dentro de una transacción, y **deja rastro en
`Auditoria`**. Sin excepción.

`cierre.ts` (los siete pasos y la publicación), `pagos.ts`, `gastosFijos.ts`,
`admin.ts` (el PIN y sus dos topes de intentos), `auditoria.ts`, `bloqueo.ts`
(bloqueo optimista para que dos pestañas no se pisen), `excel.ts`, `ruta.ts`
(lo común de todas las rutas de la API).

### `scripts/` · las puertas

No son utilidades sueltas. Cada uno es un chequeo que tiene que poder verse
fallar:

| Script | Qué comprueba |
|---|---|
| `prueba-negativa.mjs` | Inyecta **18 defectos reales** en el motor y las reglas de lectura, y exige que la suite se ponga roja. |
| `prueba-negativa-integracion.mjs` | Lo mismo con **17 defectos** en los servicios y la capa de datos. |
| `verificar-tokens.mjs` | Que no haya ni un color ni un tamaño escrito a mano fuera del sistema de diseño. |
| `verificar-secretos.mjs` | Que ninguna de las siete claves viaje al navegador. Corre sobre el bundle construido. |
| `verificar-docs.mjs` | Que cada enlace, ruta, fichero y comando citado en el README, `CLAUDE.md` y el handoff exista de verdad. Con su propia prueba negativa: `--prueba-negativa`. |
| `prueba-base-caida.mjs` | Que con la base caída la app diga qué pasa, y no una traza. |
| `comparar-con-mockup.mjs` | Que las cifras coincidan con el prototipo original. |

---

## 4. Cómo se calcula un mes

```
  Postgres
     │
     ├─ lib/datos/almanaque.ts ──── las siete tablas, de una vez
     │        │
     │        └─ lib/datos/filas.ts ── qué gasto fijo rige, cuántos m³ de lavado
     │                 │
     │                 ▼
     │          EntradasMes  (recibo, lecturas, lecturas del mes anterior,
     │                        gastos fijos, puntuales, lavado)
     │                 │
     │                 ▼
     └──────── lib/calculo/calcularMes.ts
                       │
                       ▼
                ResultadoMes  (7 cuotas, total, cuadres, motivos)
                       │
                       ▼
              app/  →  components/  →  la pantalla
```

**La regla de oro: no se guarda ninguna cuota calculada.** Se guardan las
entradas y se calcula al vuelo. Si mañana se corrige una lectura de mayo, todo lo
derivado se recalcula solo; una cuota guardada se queda vieja y nadie se entera.

La única excepción es `Cierre.instantanea`, que graba el `ResultadoMes` al
publicar. Existe para una sola cosa: que el aviso *«tu cuota pasó de X a Y»* tras
una corrección sea verificable. **No se lee para calcular nada.**

---

## 5. Las cinco reglas que no se negocian

Cada una existe porque romperla ya costó caro una vez. Están explicadas con su
historia en el código, donde viven.

1. **Nunca se guarda una cuota calculada.** Ver arriba.
   → `prisma/schema.prisma`, cabecera.

2. **Nunca `Float`.** Los montos son dinero de siete familias. Todo es `Decimal`
   con su precisión explícita, y la conversión a `number` ocurre **solo** en
   `lib/datos/decimal.ts`.

3. **Toda escritura deja rastro en `Auditoria`**, en la misma transacción.
   Y **solo se avisa sobre meses publicados**: sin ese filtro, cerrar un mes
   serían doscientas notificaciones y la campana se volvería ruido.
   → `lib/servicios/auditoria.ts`.

4. **Los meses publicados no se tocan.** Un gasto fijo que cambia de monto no
   reescribe el pasado; los m³ del lavado se congelan al publicar. Editar un mes
   publicado solo se puede por la ruta de corrección, que avisa a los siete.
   → `lib/datos/filas.ts`, `lib/servicios/cierre.ts`.

5. **Nada inventado en lo que ve el vecino.** Ni una tasa escrita a mano, ni un
   cero que en realidad significa «no medido». `monto: null` es *por confirmar* y
   `monto: 0` es *cuesta cero*: la interfaz los muestra distinto porque son
   cosas distintas.

Y una de forma: **ningún color ni tamaño escrito a mano.** Todo sale de los
tokens de `app/globals.css`, y `scripts/verificar-tokens.mjs` revienta el build
si aparece un `#fff` suelto.

---

## 6. Bob

Bob es el asistente del edificio. Explica de dónde sale una cifra, compara meses,
acompaña los siete pasos del cierre. Funciona de dos maneras y **la interfaz es
la misma en las dos**:

- **Sin `DEEPSEEK_API_KEY`:** responde con un catálogo escrito a mano. Sin red,
  sin coste, y nunca falla.
- **Con `DEEPSEEK_API_KEY`:** responde con el modelo. La clave manda; el freno de
  mano explícito es `BOB_SIN_MODELO`.

> En el panel de administración, abajo, dice **en qué modo está y por qué**. Está
> ahí porque el modo no se nota desde fuera: el catálogo responde a todo, así que
> un Bob apagado por una variable mal puesta se ve igual, solo que peor. Pasó.

Pase lo que pase, **cinco guardas duras** que viven en el código y no en el
prompt (`lib/bob/index.ts`):

1. Dos frases como máximo, venga de donde venga el texto.
2. No puede escribir: sus herramientas solo importan lectores, y hay un test que
   comprueba que ahí no aparece un `create`, `update` ni `delete`.
3. **Ninguna cifra inventada.** Si aparece un número que no salió de una
   herramienta llamada en esa conversación, la respuesta del modelo se descarta
   entera y contesta el catálogo.
4. Todo queda registrado: pregunta, llamadas y respuesta, en `ConsultaBob`.
5. Ocho segundos de plazo. Pasados, contesta el catálogo y el vecino no ve un
   error.

Bob **sí puede hacer cuentas simples** —cuántos días lleva sin pagar alguien, qué
porcentaje representa un gasto— derivándolas de las cifras que las herramientas
le dieron. Lo que no puede es traerse un número de la nada.

Dónde aparece y qué dice en cada sitio: [`docs/BOB-APARICIONES.md`](docs/BOB-APARICIONES.md).

---

## 7. Cómo se verifica que esto funciona

El principio de este proyecto: **lo verde no es evidencia.** Casi todos los
defectos graves que aparecieron pasaron por un build exitoso y una suite en
verde. Por eso hay dos capas.

### La suite

```bash
npm run verify            # tipos + tokens + documentos + 502 tests de unidad
npm run test:integracion  # 197 tests contra un Postgres de verdad
npm run test:e2e          # 167 tests de pantalla con Playwright
```

### Las pruebas negativas

**Un chequeo que nunca viste fallar no es un chequeo: es una decoración.** Estos
dos scripts inyectan defectos reales, uno por uno, y exigen que la suite se ponga
roja. Si un test desaparece o deja de cubrir lo que dice, aquí se nota.

```bash
npm run prueba-negativa                          # 18 defectos en el motor y las reglas
node scripts/prueba-negativa-integracion.mjs     # 17 defectos en servicios y datos
```

Los defectos no son inventados: son los que una auditoría adversaria encontró que
la suite **no** detectaba, más los clásicos que ya se rompieron alguna vez.

### Estado hoy

| | |
|---|---|
| Unidad | **502 ✓** |
| Integración | **197 ✓** |
| Extremo a extremo | **167 ✓** |
| Defectos inyectados detectados | **35 de 35** |
| Tokens de diseño huérfanos | **0** |
| Secretos en el bundle del cliente | **0** |

El método completo —cómo se escribe un verificador adversarial, cómo se cierra
una fase— está en [`docs/HANDOFF.md`](docs/HANDOFF.md#4-cómo-se-trabaja-en-este-repositorio).

---

## 8. Todos los comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. Sella la versión para el service worker. |
| `npm run verify` | **La puerta rápida:** tipos + tokens + documentos + unidad. |
| `npm test` | Solo los tests de unidad. |
| `npm run test:integracion` | Tests contra Postgres. Necesita `DATABASE_URL`. |
| `npm run test:e2e` | Playwright. Construye y levanta el servidor él solo. |
| `npm run prueba-negativa` | Los 18 defectos inyectados en el motor. |
| `npm run verificar-tokens` | Cero colores y tamaños fuera del sistema de diseño. |
| `npm run verificar-docs` | Que el README, `CLAUDE.md` y el handoff no manden a nadie a un sitio que no existe. |
| `npm run verificar-secretos` | Ninguna clave en el bundle. Requiere un build antes. |
| `npm run prueba-base-caida` | Que la app se comporte con la base caída. |
| `npm run db:migrate` | Aplicar migraciones en desarrollo. |
| `npm run db:deploy` | Aplicar migraciones en producción. |
| `npm run db:seed` | Sembrar los datos reales del edificio. |
| `npm run db:reset` | Borrar y volver a sembrar. **Destructivo.** |
| `npm run golden` | Regenerar las cifras de referencia del mockup. |
| `npm run lighthouse` | Medir rendimiento y accesibilidad. |
| `npm run iconos` | Regenerar los iconos de la PWA. |

---

## 9. Dónde está cada documento

### Para trabajar en el código

| Documento | Para qué |
|---|---|
| **[`docs/HANDOFF.md`](docs/HANDOFF.md)** | **Empieza aquí si vas a continuar el proyecto.** Estado exacto, decisiones tomadas y por qué, arquitectura, y el catálogo de defectos históricos. |
| [`CLAUDE.md`](CLAUDE.md) | Instrucciones para una sesión de Claude Code: método, convenciones y trampas del entorno. |
| [`docs/PLAN.md`](docs/PLAN.md) | El plan escrito en la Fase 0, antes de la primera línea de código. |

### Para operar y desplegar

| Documento | Para qué |
|---|---|
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Desplegar desde cero, paso a paso, sin nadie delante. Una hora. |
| [`docs/RENDIMIENTO.md`](docs/RENDIMIENTO.md) | Por qué la app iba lenta y qué se hizo. Todo medido. |

### El encargo original

`mockup/design_handoff_edificio_salazar_barreto/` es **la fuente de verdad** del
diseño y de las reglas. Cuando el código y estos documentos discrepen, mandan
estos:

| Documento | Qué define |
|---|---|
| `01-reglas-de-negocio.md` | Las fórmulas. Cómo se reparte cada cosa. |
| `02-sistema-de-diseno.md` | Colores, tipografías, espaciados. Los valores exactos. |
| `03-pantallas.md` | Las pantallas del vecino y sus textos. |
| `04-cierre-del-mes.md` | Los siete pasos del cierre y sus textos. |
| `05-bob-agente.md` | Qué es Bob y cómo habla. |
| `06-modelo-de-datos.md` | El modelo de datos y sus dos reglas. |

> ⚠️ `mockup/**/support.js` es código del prototipo. **No se mira y no se
> porta.** Lo dice el encargo.

### Lo que se verificó, fase por fase

`docs/verificacion-0.md` … `docs/verificacion-8.md`, una por fase, y
[`docs/AUDITORIA-FINAL.md`](docs/AUDITORIA-FINAL.md), escrita como si no hubiera
construido el proyecto. Dicen qué quedó verificado, qué quedó fuera y por qué.

---

## 10. Operar la app cada mes

Quien administra entra a `/admin` con su PIN y sigue **siete pasos**: las siete
lecturas del medidor, la factura de agua, el recibo de luz, los gastos fijos, lo
puntual del mes, la revisión —donde ve cuánto se mueve cada cuota respecto al mes
anterior— y publicar.

Al publicar, los siete reciben un aviso. Se puede salir a mitad y volver al mismo
paso desde otro teléfono.

Si después hay que corregir algo, la ruta de corrección recalcula, exige que el
mes siga cuadrando y **avisa a los siete con el monto anterior y el nuevo**.

El detalle está en [`docs/DESPLIEGUE.md` §Lo que hay que hacer cada mes](docs/DESPLIEGUE.md#lo-que-hay-que-hacer-cada-mes).

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5.9 en modo estricto ·
Tailwind CSS 4 con tokens propios · Prisma 6 + PostgreSQL 16 ·
Vitest 3 · Playwright 1.63 · fast-check · web-push.

Todo el código y todos los comentarios están **en español**. Es deliberado: lo
mantiene gente que habla español, y los comentarios explican *por qué* algo está
así, no *qué* hace.
