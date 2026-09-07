# PLAN · App del edificio Jr. Enrique Salazar Barreto

> Escrito en la Fase 0, antes de la primera línea de código de producción.
> Se actualiza si una fase posterior obliga a cambiar una decisión, y el cambio
> se anota con su motivo.

---

## 1. Qué se está construyendo

Una aplicación web instalable (PWA) para los siete hogares del edificio. Su razón de
existir es que **cada sol sea visible y explicable**: toda cuota se abre y muestra cómo
se calculó, con los números del recibo de SEDAPAL al lado.

El mockup de `mockup/` es la **especificación visual y funcional**, no una versión
temprana del código. De él se porta con fidelidad literal:

- los valores de diseño de `02-sistema-de-diseno.md` (color, tipografía, escala, radios,
  espaciado, animación),
- los copys de `03-pantallas.md` y `04-cierre-del-mes.md`,
- las reglas de `01-reglas-de-negocio.md` y el motor de `datos-edificio.js`.

Todo lo demás —arquitectura, nombres, composición, endpoints, caché, tests— se decide
aquí. `support.js` no se mira ni se porta.

---

## 2. Stack

| Capa | Elección | Versión instalada |
|---|---|---|
| Framework | Next.js App Router + TypeScript strict | next 15.5.25 · typescript 5.9.3 |
| UI | React | 19.2.8 |
| Estilos | Tailwind CSS 4 con `@theme` | 4.3.3 |
| Estado servidor | TanStack Query v5 | 5.102.8 |
| Backend | Route Handlers en el mismo repo | — |
| Base de datos | PostgreSQL | 16 (local) / Railway (producción) |
| ORM | Prisma con migraciones versionadas | 6.19.3 |
| Validación | Zod, esquemas compartidos | 3.25.76 |
| Tests unitarios | Vitest | 3.2.7 |
| Property testing | fast-check | 4.9.0 |
| Tests e2e | Playwright + axe-core | 1.63 / 4.13 |
| Excel | ExcelJS (servidor) | 4.4.0 |
| Bob | adaptador propio · DeepSeek V4 Flash | — |

**No se instala** ninguna librería de componentes, de gráficos ni de animación. Los
gráficos son barras y sparklines: SVG a mano.

### Desviaciones respecto del prompt, con su motivo

- **Prisma 6, no 7.** Prisma 7 rompe la resolución de dependencias del npm 10.9.7 de
  este entorno (`Cannot read properties of null (reading 'edgesOut')` en el peer set de
  `vitest`). Prisma 6 es la última rama estable que instala limpio y no cambia nada de
  lo que este proyecto usa: `Decimal`, `@@unique`, transacciones interactivas.
- **Sin ESLint.** `eslint-config-next@15` no resuelve contra el `eslint@10` del entorno,
  y `next lint` está deprecado en Next 15. El pipeline de calidad se sostiene en
  `tsc --noEmit`, `verificar-tokens`, Vitest y Playwright, que es lo que el prompt pide
  en la Fase 7. Se anota como deuda en la auditoría final.

---

## 3. Árbol de archivos

```
app/
  layout.tsx                      fuentes, providers, metadatos PWA
  globals.css                     @theme · los tokens · las utilidades de la escala
  page.tsx                        raíz: onboarding o Inicio según el dpto elegido
  (pantallas)/                    rutas de vecino
    mes/page.tsx
    mi-departamento/page.tsx
    historial/page.tsx
    avisos/page.tsx
    admin/page.tsx
  api/
    meses/route.ts
    meses/[mes]/route.ts
    meses/[mes]/borrador/route.ts
    meses/[mes]/lecturas/route.ts
    meses/[mes]/recibo/route.ts
    meses/[mes]/gastos/route.ts
    meses/[mes]/reasignaciones/route.ts
    meses/[mes]/publicar/route.ts
    meses/[mes]/corregir/route.ts
    dptos/[id]/historial/route.ts
    pagos/aviso/route.ts
    pagos/confirmar/route.ts
    gastos-fijos/route.ts
    avisos/route.ts
    avisos/leer/route.ts
    admin/pin/route.ts
    export/[anio]/route.ts
    bob/route.ts

lib/
  calculo/                        MOTOR PURO · sin efectos, sin dependencias
    constantes.ts                 DPTOS, GASTOS_FIJOS, LAVADO, SALDO_BASE
    tipos.ts                      Departamento, Recibo, Lecturas, Overrides, ResultadoMes, CuotaDpto
    redondeo.ts                   round2, round3, fmt, fmt3
    calcularMes.ts                la función principal
    saldo.ts                      serieSaldo, saldoAl
    correccion.ts                 proponerCorreccion
    mes.ts                        aritmética de meses ('2026-07' → '2026-06')
    index.ts
    __tests__/                    los 14 casos de 01 §10 + propiedades + bordes
  esquemas/                       Zod compartido cliente/servidor
  datos/                          acceso a Prisma · lectura de las entradas de un mes
  servicios/                      casos de uso: transacción + auditoría + avisos
  bob/                            tipos, herramientas, determinista, deepseek, prompt, index
  copys.ts                        TODOS los textos de pantalla, literales
  formato.ts                      fmt/fmt3 para la interfaz
  dispositivo.ts                  el dpto elegido, guardado en el dispositivo

components/
  ui/                             Etiqueta, Cifra, PildoraEstado, TarjetaNoche,
                                  TarjetaBlanca, FilaDivisoria, Boton, BotonSecundario
  pantallas/                      una por P0..P5 + admin
  hojas/                          calculo, pagar, aviso-ok, pagos, agua, bob, wizard,
                                  cargos, export, numpad
  graficos/                       Barras, Sparkline, BarraSegmentada, TiraMeses

prisma/
  schema.prisma
  migrations/
  seed.ts

scripts/
  verificar-tokens.mjs            falla el build si hay un valor huérfano

tests/                            Playwright: responsive, flujo del cierre, a11y

docs/
  PLAN.md · DESPLIEGUE.md · verificacion-0..8.md · AUDITORIA-FINAL.md
```

---

## 4. Decisiones tomadas

### 4.1 El motor de cálculo es puro y no conoce la base de datos

`lib/calculo/` recibe un objeto de entradas (`EntradasMes`: recibo, lecturas del mes y
del anterior, gastos fijos vigentes, extras, m³ del lavado) y devuelve `ResultadoMes`.
No importa Prisma, no lee variables de entorno, no usa `Date.now()`.

Consecuencia deliberada: el mismo motor corre en el servidor (API, publicación,
Excel, Bob) y en el cliente (el borrador del cierre del mes recalcula al vuelo mientras
el administrador teclea, sin ida y vuelta al servidor). Y los tests lo ejercitan sin
levantar nada.

### 4.2 `number` para el cálculo, `Decimal` para la persistencia

El motor de referencia opera en punto flotante de doble precisión con
`Math.round(x*100)/100` en puntos exactos. **El cuadre depende de dónde cae cada
redondeo**, así que portarlo a `Decimal.js` cambiaría resultados en el último céntimo y
rompería la fidelidad que la Fase 1 exige verificar al céntimo contra el mockup.

Entonces: el motor usa `number`; la base de datos usa `Decimal(10,3)` / `Decimal(10,2)`
/ `Decimal(5,2)`, y la conversión ocurre en una única capa (`lib/datos/`) que convierte
`Prisma.Decimal → number` al leer. Nunca `Float` en el esquema.

### 4.3 Nunca se guarda una cuota, con una excepción

Se guardan entradas; las cuotas se calculan al vuelo. La única excepción es la
**instantánea** que se graba junto al cierre al publicar un mes: es lo que hace
verificable el aviso *"tu cuota pasó de X a Y"* después de una corrección.

### 4.4 Toda escritura pasa por `lib/servicios/`

Ninguna ruta de API toca Prisma directamente. Cada caso de uso abre una transacción
interactiva que hace, en este orden y sin excepción:

1. lee el estado anterior,
2. escribe el cambio,
3. escribe `Auditoria` con `valorAnterior` y `valorNuevo`,
4. escribe `Aviso` **solo si el mes ya estaba publicado** (o si la acción es publicar,
   confirmar un pago, cambiar un gasto fijo o mover una reasignación).

Si el aviso no corresponde, no se escribe: cerrar el mes no puede generar doscientas
notificaciones.

### 4.5 El saldo acumula hacia adelante

`serieSaldo()` parte de un `saldoInicial` real guardado en la base (tabla
`ConfiguracionEdificio`) y acumula hacia adelante. La derivación hacia atrás desde
`SALDO_BASE` del prototipo se conserva **solo** como función aparte
(`serieSaldoDerivada`) para poder comparar contra el mockup en la Fase 1, y no la usa
ninguna pantalla ni ningún endpoint.

### 4.6 El PIN vive en el servidor

`ADMIN_PIN` es variable de entorno del servidor. `POST /api/admin/pin` lo valida, aplica
límite de intentos por IP y devuelve una cookie de sesión corta, `httpOnly`, firmada.
Toda ruta de administración exige esa cookie. El cliente nunca ve el PIN ni puede
deducirlo.

### 4.7 Cero valores huérfanos, verificado por script

Los tokens viven en `@theme` de `app/globals.css`. Ningún `.tsx` contiene un hex, un
`rgb(`, un `px` suelto ni una clase de color de Tailwind por defecto.
`scripts/verificar-tokens.mjs` lo comprueba y sale con código distinto de cero si falla.
Está en `npm run verify` y en CI.

La lista blanca de `px` literales es explícita y comentada dentro del script: solo
valores geométricos de SVG (`viewBox`, `stroke-width`) y las tres variables de
`--top/--bot/--rad`, que por definición son medidas de dispositivo.

### 4.8 El marco de teléfono no existe

El prototipo se dibuja dentro de un marco de 390×844 con sombra porque tenía que verse
en un navegador de escritorio. En producción:

- teléfono vertical (`max-width: 540px`): la app ocupa la pantalla, sin marco, radio 0;
- pantalla baja (`max-height: 560px`): columna de `min(430px, 100vw)`;
- tablet y escritorio: marco centrado de 390×844, topado en `calc(100dvh - 56px)`.

No hay layout de escritorio de dos columnas. Decisión tomada con el cliente.

### 4.9 Navegación real, no estado de pantalla

El prototipo guarda `pantalla` y `hoja` en un objeto de estado. En producción las seis
pantallas son **rutas** (para que el botón atrás del sistema funcione y para que un
aviso pueda enlazar a un sitio), y las hojas modales son **estado de historia**
(`history.pushState`), de modo que el botón atrás y el gesto de deslizar cierran la hoja
activa antes de navegar. Esto el mockup no lo implementa y hay que hacerlo.

### 4.10 Los copys son contenido, no decoración

Todos los textos de pantalla viven en `lib/copys.ts`, transcritos literalmente de `03` y
`04`. Los que llevan un número son funciones que reciben el valor del cálculo: nunca se
escribe un `1.50` fijo en una frase. La Fase 9 verifica esto cambiando el lavado a 3 m³
y recorriendo la app entera.

---

## 5. Dudas que resolví solo, y con qué criterio

| Duda | Resolución | Criterio |
|---|---|---|
| Las píldoras de estado sobre fondo noche usan `#E8A94A` y `#7BD3A0`, que no están en los 18 colores de `02` §1. | Se añaden como tokens `--color-ambar-claro` y `--color-verde-claro`, documentados como "la versión clara" que `02` §4.2 menciona sin dar valor. | `02` §4.2 dice que sobre noche "el texto usa la versión clara"; el mockup da los valores. Entre inventar un valor y tomar el del mockup, gana el mockup: es la referencia visual literal. |
| `02` §4.2 dice que sobre noche el fondo de la píldora sube a `.18`; el mockup usa `.14`–`.15`. | Se usa el del mockup y se anota la discrepancia en `verificacion-2.md`. | Ante conflicto entre la tabla y el prototipo en un valor visual, gana lo que se validó en pantalla con el cliente. La diferencia es invisible y la contradicción queda declarada, no escondida. |
| El prototipo pinta el estado `aviso` en celeste (`#3E93B8`) en la barra segmentada y en las filas, mientras `01` §7 dice "gris · En verificación". | Se respeta `01` §7 para la **píldora** (gris/neutro suave) y el mockup para los **puntos y barras** (celeste). | Son dos elementos distintos: la píldora es el estado nombrado, el punto es un código de color de la lista, que el propio mockup rotula con leyenda ("Por confirmar"). Ninguna de las dos fuentes se contradice si se leen como lo que son. |
| `MESES` del prototipo llega solo hasta junio 2026, pero hay lecturas y recibos de julio. | La lista de meses se deriva de la base de datos (los meses con recibo), no de una constante. Julio existe como mes en curso, sin publicar. | El prototipo congela la lista porque no tiene backend. En producción el mes en curso es precisamente el que el administrador está cerrando. |
| `calcularMes` del prototipo devuelve `null` si falta el recibo o el mes anterior. | El motor devuelve un `ResultadoMes` con `valido: false` y un motivo, nunca `null` ni `NaN`. | El prompt exige que `m3Sedapal === 0` devuelva "un resultado marcado como inválido, no NaN". Un solo camino de error es más simple de consumir que dos. |
| El prototipo usa `flat` como número y calcula `Math.round(baseMant * flat) / 100`. | Se porta esa expresión tal cual. | Es idéntica a `round2(baseMant * flat / 100)`, pero se conserva la forma escrita para que la comparación línea a línea con el original sea trivial. Se documenta la equivalencia en el código. |
| ¿Autenticación por vecino? | No. El departamento se elige una vez y se guarda en el dispositivo. Solo el PIN de administración se valida contra el servidor. | `06` §5: los datos son públicos entre los siete por diseño; la transparencia es el punto. Añadir identidad sería trabajo que nadie pidió y una pantalla más que mantener. |
| ¿Notificaciones push? | Se implementa la campana en la app y se deja el enganche de Web Push preparado, sin activarlo. El enlace de WhatsApp queda documentado como alternativa. | `06` §4 dice que push es la recomendación pero que el enlace de WhatsApp sería **además**, nunca en lugar de. Activar push exige claves VAPID y un permiso que solo tiene sentido pedir con datos reales cargados. Se declara como pendiente en la auditoría. |

---

## 6. Orden de trabajo

El del prompt, que coincide con el de `README.md` §9: primero el motor con tests, luego
tokens, luego datos y API, luego las pantallas de solo lectura, luego el cierre del mes,
luego PWA y accesibilidad, luego deploy y CI, luego Bob, y al final la auditoría
adversaria.

Cada fase cierra con su verificador ejecutado, no leído, y con su
`docs/verificacion-N.md` diciendo el estado real: qué quedó verde, qué no, y por qué.
