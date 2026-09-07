# Auditoría final · Salazar Barreto

> Escrita como si no hubiera construido el proyecto. Fase 9 del encargo. El
> mandato era ser duro: «un informe que dice que todo está perfecto no me
> sirve». Esto no lo dice.
>
> Cómo se hizo: cinco verificadores adversariales en paralelo, solo lectura, con
> ángulos que apenas se solapan —números y motor, fidelidad y copys, seguridad,
> si los propios chequeos mienten, y responsive—. Cada hallazgo se **volvió a
> confirmar ejecutando** antes de tocar nada; los que no se sostuvieron se
> descartaron y se dicen abajo. Los arreglos los apliqué yo, con su prueba
> negativa: el defecto reintroducido a mano tiene que poner algo en rojo, o el
> arreglo no cuenta.

---

## 1. La respuesta que permite decidir

**El motor de cálculo es fiel al mockup al céntimo** —los 8 meses y ~20 000
combinaciones aleatorias, cero divergencias— y **ninguna cifra la fabrica nadie
fuera de él**. Lo que la auditoría encontró no estaba en el cálculo: estaba en
los bordes. Dos cosas movían plata en silencio y ya están arregladas (el
descuento de SEDAPAL que no se podía teclear, y el límite del PIN que se saltaba
falseando una cabecera). Un puñado de textos mentían en algún estado, y varias
animaciones y detalles del diseño se habían perdido; todo eso está corregido. Y
la propia red de tests tenía ocho puntos ciegos que dejaban pasar defectos
reales, que era lo más peligroso porque apagaba la sospecha.

**Lo que queda en tus manos**, y solo eso: cargar los datos reales del edificio
(§5), poner los secretos, y darle deploy en Vercel y Railway. Nada del código
está a medias. Lo que **no** se pudo verificar aquí —porque necesita un teléfono
de verdad, un modelo de lenguaje con clave, o los servicios en la nube— está en
§4, sin adornos.

Estado de la puerta, medido al cerrar:

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio, sin un `any`, `@ts-ignore` ni `as` sin comentar |
| `node scripts/verificar-tokens.mjs` | cero valores huérfanos · 192 ficheros |
| `npx vitest run` | **343 / 343** |
| `npm run test:integracion` | **120 / 120** |
| `npx playwright test` | **157 / 157** en una corrida limpia |
| `node scripts/verificar-secretos.mjs` | cero secretos en el bundle, ahora incluido `public/` |

---

## 2. Lo que encontré, por severidad

Severidad = cuánto cuesta si es cierto. **CRÍTICO** mueve plata o miente en
pantalla; **ALTO** rompe un contrato del diseño o de los chequeos; **MEDIO**/
**BAJO**, lo demás.

### CRÍTICO — arreglados

| # | Qué | Cómo se demostró | Arreglo |
|---|---|---|---|
| C1 | **El descuento de SEDAPAL no se podía teclear en ninguna pantalla.** El motor, el esquema y la base lo soportaban; la casilla no existía. Un mes con descuento se cobraba de más con los cuatro cuadres en verde. | 0 apariciones de «descuento» en `components/`; con el recibo real de mayo (S/ 325 − 17.33) los siete pagaban S/ 16.96 de más. | Casilla opcional en el paso 2. Test de integración del recorrido servicio→base→cálculo. |
| C2 | **El límite del PIN se saltaba rotando `x-forwarded-for`.** El contador es por IP, la IP la pone quien pide. Con IP fija el 9º intento daba 429; rotándola, los 10 000 PINes al alcance sin un solo bloqueo. | Reproducido contra la app construida: 50 intentos rotados, 0 bloqueos. | `x-real-ip` primero (lo fija la plataforma), y un **tope global** de 40 fallos por ventana. Probado: el intento 41 rotado da 429. |
| C3 | **El saldo contaba meses no publicados.** `serieDelSaldo` usaba los meses con recibo; al teclear el recibo del mes en curso, Bob y el Excel recitaban un saldo con un salto de miles de soles mientras Inicio enseñaba otro. | Con rollback: tras el paso 2 de julio, la serie saltaba a S/ 808.02 contra los S/ 4 182.40 de Inicio. | `serieDelSaldo` filtra por publicado. Test probado en rojo. |

### ALTO — arreglados

| # | Qué | Arreglo |
|---|---|---|
| A1 | La tira ENE→DIC de Mi departamento mostraba el mes equivocado a partir de la 13.ª publicación (enero 2027): se llenaba por posición con el eje fijo. | `vistaAnual` indexa por mes de calendario. Test unitario en rojo con el defecto. |
| A2 | «pagado en 2026» y «promedio del año» sobre una ventana móvil de 12 meses, no sobre el año. | Acotados al año que se mira, con el año dinámico. |
| A3 | Paso 7: «Ya te la redacté» con los tres campos vacíos en un mes sin cerrar. | La intro distingue si hay borrador. |
| A4 | Paso 6: el botón decía «Revisa las lecturas» aunque faltara el recibo. | El botón nombra lo que falta. |
| A5 | «A cada uno le llega un aviso con su monto»: publicar crea un aviso global sin montos por dpto. | Copy alineado con lo que hace y con el mockup. |
| A6 | La nota «todo dentro de su rango habitual» afirmaba una comparación que el código no hace. | Reescrita a lo que de verdad comprueba. |
| A7 | Paso 6 no mostraba la diferencia de cada cuota respecto al mes anterior (el mockup la pinta ámbar/verde). | Columna añadida; `cuotasAnteriores` en el borrador. |
| A8 | **`verificar-secretos` no miraba `public/`** (donde vive `sw.js`). Un secreto ahí pasaba como «limpio». | `public/` en el alcance. Probado en rojo con el `ADMIN_SECRETO` en un `public/*.js`. |
| A9 | **El test «los diez mil PINs» no podía fallar**: fuerza bruta de claves de 4 dígitos contra una firma que por contrato tiene ≥32 caracteres. | Aserción de propiedad: la firma no coincide con ninguna derivación del PIN. Probada en rojo. |
| A10 | **Tres cláusulas de `revisarResultado` no se probaban en dirección de fallo.** | `sanidad.test.ts` construye meses malos y exige que los cace. Cada cláusula probada en rojo. |
| A11 | **El monto de un gasto se salía de la pantalla en Inicio y se recortaba en silencio** (fila flex sin `min-width:0`; `.marco-app` recorta con `overflow:hidden`, así que ni `scrollWidth` lo veía). ElMes ya lo hacía bien. | `min-w-0 truncate` en el concepto, `shrink-0` en el monto. |
| A12 | **El teclado numérico se dibujaba fuera de `.marco-app`**: en escritorio ocupaba los 1440px del viewport en vez de la columna de 390. Su `position:absolute` resolvía contra el viewport porque se montaba como hermano del marco. | Se pinta dentro del marco con un portal a `#marco-app`. |
| A13 | **En apaisado, el teclado numérico cortaba su propia etiqueta y el valor** (panel más alto que el viewport, `flex-end` empuja el sobrante fuera de alcance). | `overflow-y:auto` + `margin-top:auto`: el sobrante se puede desplazar. |

### MEDIO — arreglados

| # | Qué | Arreglo |
|---|---|---|
| M1 | El paso 5 decía «activo · se descuenta del área común» aunque el lavado no se aplicara (poca área común o reparto ajustado). `01` §3.3 exige decirlo. | El borrador expone `aplicado`; el paso 5 lo dice. Test en rojo. |
| M2 | Bob, en el paso 3, repetía el monto de la luz en vez de compararlo con el mes anterior (el paso 2 ya lo hacía). | Compara; se añadió `luzAnteriores`. |
| M3 | El panel decía «ESCRIBIR MONTO» en una fila que no se puede tocar. | «por confirmar», un estado, no una orden. |
| M4 | La pantalla de «publicado» había perdido su tarjeta noche. | Restaurada. |
| M5 | Faltaban dos animaciones de `02` §6: la cifra que cuenta desde 0 y las barras que crecen. La barra además animaba `height` (layout, prohibido). | `CifraContada` (sin salto de hidratación, apagada bajo `prefers-reduced-motion`) y barras con `transform: scaleY`. |
| M6 | El panel colapsaba «Cargos adicionales y créditos» en una fila rotulada solo por el lavado. | La fila se llama por lo que abre. |
| M7 | `verificar-tokens` no aplicaba las reglas de color a los `.css` ni miraba `public/`. | hex y rgb valen en `.css` (exento el de tokens); `public/` en el alcance. Probado con un `.css` de fixture. |
| M8 | `medir-tolerancia.mjs` imprimía una contradicción (peor error 0.11 «sobre» una tolerancia de 0.03, y falla 0) y no fallaba por lo que mide. | Mensaje alineado con la tolerancia adaptativa; falla si un cuadre se rompe. |
| M9 | Un mes publicado sin recibo (estado incoherente) daba 404 «esta página no existe» en `/mes` mientras Inicio mostraba su estado vacío. | La puerta de `/mes/[mes]` mira «¿publicado?», no «¿tiene recibo?»; el resultado inválido muestra `SinDatos`. |
| M10 | El teclado numérico no respetaba `env(safe-area-inset-bottom)`: la fila Cancelar/Guardar caía en la zona del gesto de inicio del iPhone. | `padding-bottom: calc(30px + env(safe-area-inset-bottom))`. |
| M11 | `.bob-chips` era un carrusel horizontal sin declarar `data-scroll-x`, que es lo que el chequeo de desbordes usa para perdonar un scroller intencional. | `data-scroll-x` añadido. |

### BAJO — arreglados

`sr-only` redundante en la línea de Bob; la tercera línea que faltaba en la
pantalla de error global; los subtítulos de ejemplo de los botones del paso 5;
`comparar-con-mockup.mjs` con la ruta del CDN codificada a una carpeta de sesión
(ahora sale de `CDN_LOCAL` y se declara apoyo de desarrollo, no chequeo); el
barrido de desbordes que no contaba cuántos elementos miraba; una etiqueta del
enlace de Bob que la pasada de textos había cambiado y dejó un e2e en rojo;
`credito` era el único campo de dinero que salía sin redondear a céntimos.

### Del endurecimiento del motor (batería de casos hostiles)

Antes de la auditoría de fases, una batería de 20 000 combinaciones hostiles por
corrida encontró cinco defectos más, todos arreglados y todos con ni un céntimo
movido en los ocho meses de la semilla: **un mes de reparto ajustado no se podía
publicar nunca** (la tolerancia era constante y el error crece con el precio del
m³: de 137 146 fallos sobre 300 000 a cero), el área común salía negativa,
ignorar el descuento pasaba los cuatro cuadres, un precio por m³ infinito con
`aguaM3` denormal, y una cuota total negativa cuando el crédito se come el mes.

---

## 3. Lo que NO arreglé, y por qué

Con honestidad, que es lo que se pidió.

1. **El congelado del lavado al publicar no lo revierte una corrección.**
   Si un mes se publica con el lavado configurado pero **no aplicado** (poca área
   común), se graba `activa: false`, y una corrección posterior que restaure el
   área común **no recupera el lavado**: el 401 seguiría pagando S/ 6.25 de menos
   y los otros seis, de más. No lo arreglé porque el arreglo correcto depende de
   una decisión de producto que no me toca inventar: al corregir, ¿el lavado debe
   usar los m³ **congelados** al publicar, o los **globales de hoy** (que pueden
   haber cambiado de 1.50 a 3.00)? Las dos respuestas son defendibles y mueven
   plata distinto. **Propuesta**: re-evaluar `activa` en `corregirMes` con el
   resultado recalculado, conservando los m³ congelados; una corrección restaura
   la aplicabilidad sin importar un cambio global silencioso. Necesita tu visto
   bueno. Es un caso de borde (mes publicado con lavado on pero brutoComun < 1.5,
   luego corregido), no el camino normal.

2. **`Cierre.instantanea` se escribe y no se lee.** Es la única excepción
   declarada a «nunca se guarda una cuota», y su comentario dice que hace
   verificable el aviso «tu cuota pasó de X a Y» — pero `corregirMes` recalcula
   el antes y el después y nunca la mira. No la quité porque quitar una columna
   es una migración destructiva que prefiero que decidas: o se usa de verdad, o
   se borra. Hoy es peso muerto, no un riesgo.

3. **`departamento.flat` en la base es decorativo.** El motor reparte con la
   constante de `constantes.ts`; nada lee la columna. Hoy coinciden. Son dos
   verdades sin candado: editar la base no cambiaría un céntimo y nadie se
   enteraría. Lo dejo como está porque la fuente correcta es la constante (el
   reparto es una regla de negocio, no un dato editable), pero convendría **quitar
   la columna** o añadir un test que compare las dos, para que no engañe.

4. **El `saldoInicial` de la semilla es una muleta.** El motor acumula hacia
   adelante (correcto), pero el saldo inicial de la semilla está calculado hacia
   atrás para que junio cierre en la cifra del prototipo. Está marcado `EJEMPLO`.
   No es un bug del código: es un dato que tienes que reemplazar (§5).

5. **Cobertura de chequeos que sigue siendo parcial**, dicho sin maquillar:
   no hay prueba negativa de la capa de pantalla (un `VERSION='v1'` en `sw.js` o
   la limpieza de cachés desactivada pasan la suite de Playwright); la
   comparación de tiempo constante del PIN no la comprueba ningún test (es difícil
   de medir sin falsos positivos); `lighthouse.mjs` y `prueba-base-caida.mjs`
   levantan `next start` sin `npm run build` delante, así que pueden medir un
   `.next` viejo; y el CI ejecuta 7 pasos, no los 9 que `docs/verificacion-7.md`
   daba a entender (Lighthouse y la prueba de base caída no bloquean el deploy).
   Todo esto está acotado y ninguno deja pasar un error de dinero; son mejoras de
   la red, no agujeros en el producto.

6. **Notificaciones: HECHO** (§9.6.7). Se construyeron las dos, tras confirmarlo
   contigo. **Push**: claves VAPID, `push`/`notificationclick` en el service
   worker, modelo `PushSubscription`, rutas de suscribir/desuscribir, botón
   «Activar avisos» en Mi Departamento (navegador y PWA), y disparo al publicar y
   al corregir. La lógica del servidor está probada con `web-push` simulado; la
   **entrega real solo se verifica desplegada** (HTTPS + claves reales). **Enlace
   de WhatsApp**: popover «avísales a los demás» al publicar y corregir, con el
   mensaje listo para copiar y un botón `wa.me`. Ver `docs/CAMBIOS-DATOS-REALES.md`.

7. **Toda la tipografía va en `px`, no en `rem`.** El ajuste de «tamaño de letra»
   del sistema operativo no la agranda (el zoom del navegador sí funciona, y está
   permitido hasta ×5). Es fiel al sistema de diseño, que fija cada tamaño en px,
   pero para siete vecinos que pueden ser mayores, convendría un pase a `rem`
   partiendo de los mismos valores. Es una mejora de accesibilidad, no un
   incumplimiento duro de WCAG. Lo dejo como decisión tuya porque toca la escala
   tipográfica entera, que es diseño validado.

8. **Cinco cosas menores, medidas y declaradas** (todas BAJO): a 320px se corta
   por 3px el concepto del lavado en la hoja de cargos; el panel de admin con la
   base vacía muestra «SIN AVISO» sin nombre de mes; `URL.revokeObjectURL` se
   llama justo tras `click()` (funciona en Chromium; WebKit a veces necesita
   diferirlo — a vigilar si un iPhone no descarga el Excel); y `/mes` no entra en
   la caché sin conexión por ser un `redirect`, pero su destino sí y el respaldo
   lo cubre. Ninguna mueve dinero ni impide usar la app.

9. **La app no autentica a los vecinos.** `GET /api/dptos/501/historial` le
   responde a cualquiera. Es coherente con un producto sin roles (siete vecinos
   que confían entre sí), pero **tiene que ser una decisión tuya, no un
   descuido**. Hoy: cualquiera con el enlace ve el historial de cualquier
   departamento, y puede dejar un aviso de pago falso a nombre de otro (no
   confirmarlo: eso sí pide PIN). Si el edificio quiere privacidad entre vecinos,
   hace falta autenticar al vecino; no es un parche, es una función.

---

## 4. Lo que hace falta antes de usarlo de verdad

Ninguno es código a medias; son cosas que **solo se pueden verificar fuera de
aquí**.

1. ~~Una corrida limpia de `npx playwright test`.~~ **Hecha**: 157/157 con la
   máquina para el e2e solo. Cazó dos regresiones que la contención escondía —una
   etiqueta de enlace que la pasada de textos cambió, y la tarjeta noche
   restaurada del «publicado» que reventaba por un formato de mes—, las dos ya
   arregladas. Los unitarios (343) y los de integración (120) también en verde.
2. **Probarlo en un teléfono de verdad**, iOS y Android. Todo el responsive es
   Chromium redimensionado. Un teclado de sistema real, un notch, un navegador
   embebido: nada de eso lo ve un emulador.
3. **Enchufar DeepSeek con una clave** y mirar `consulta_bob` el primer día. Todo
   el camino del modelo está probado contra un `fetch` interceptado; nunca se ha
   llamado al modelo real. Si todas las filas salen con `motivoCaida = 'error-del-modelo'`,
   es el adaptador; si con `'numero-inventado'`, el prompt. Y confirmar el
   identificador exacto de «DeepSeek V4 Flash» contra su documentación: hoy es
   `deepseek-chat`, configurable por `DEEPSEEK_MODELO`.
4. **Ejercitar Railway y Vercel.** Todo corrió contra un PostgreSQL local. El
   pooler en modo transacción, `DIRECT_URL` en las migraciones, y los tiempos de
   arranque en frío de Vercel no se han tocado. `docs/DESPLIEGUE.md` los explica;
   explicarlos no es haberlos probado. Recomendado: correr `npm run test:integracion`
   una vez contra la base de Railway antes de cargar datos reales.
5. **VoiceOver y TalkBack de verdad.** `axe` no toca nada; comprueba el marcado,
   no si un lector de pantalla se entiende. El recorrido con teclado sí está
   probado; el de voz, no.

---

## 5. Los datos reales que tienes que cargar tú

Todo lo de la semilla está marcado `EJEMPLO`. Lo que hay que reemplazar, en
`prisma/seed.ts` o por la interfaz una vez desplegado:

1. **Los 7 departamentos**: nombres reales, flat (% de metraje) y piso. Los
   flats tienen que sumar 100.00 exactos (hay un test que lo exige).
2. **Las lecturas de medidor** de cada mes que quieras cargar de arranque, las 7
   por mes. Se leen el día 25.
3. **Los recibos**: m³ y monto de SEDAPAL, monto de luz común, y el descuento si
   lo hubo (ahora ya se puede teclear).
4. **Los gastos fijos**: los montos reales de los diez conceptos.
5. **Los pagos** ya confirmados, con su fecha y número de operación.
6. **El saldo inicial real** de la cuenta conjunta, y desde qué mes cuenta. Hoy
   es una cifra derivada hacia atrás; tiene que ser el saldo bancario de verdad,
   o todo lo que la app dice de «La cuenta» es ficción con dos decimales.
7. **Los datos de la cuenta bancaria** para la pantalla de «Cómo pagar»: banco,
   número, CCI, titular.
8. **El PIN de administración** y las claves: `ADMIN_PIN`, `ADMIN_SECRETO`
   (`openssl rand -base64 32`), `DATABASE_URL`/`DIRECT_URL` de Railway,
   `NEXT_PUBLIC_APP_URL`, y `DEEPSEEK_API_KEY` cuando quieras encender el modelo.

---

## 6. Bajo qué condición esta auditoría estaría equivocada

- **El e2e ya corrió limpio: 157/157.** Lo que empezó como «tres rojos que
  parecían de contención» resultó ser dos regresiones reales que yo mismo
  introduje arreglando otras cosas —una etiqueta de enlace y la tarjeta noche del
  «publicado»—; la corrida limpia las destapó y están arregladas. La lección:
  bajo contención no se distingue un rojo ambiental de uno real, así que el e2e
  hay que correrlo en una máquina en reposo, y ahí es donde di la cifra.
- **El motor.** Si el PostgreSQL de Railway aplicara los `CHECK` o las claves
  foráneas distinto que el local, la mitad de las defensas de integración estaría
  comprobando algo que allí no existe. Señal: `npm run test:integracion` contra
  Railway.
- **Bob.** Todo el modelo está simulado. La primera fila real de `consulta_bob`
  con `modo = 'deepseek'` y sin una sola cifra en la respuesta es la señal de que
  la guarda de números no ve lo que no tiene dígitos.

---

## 7. Lo que sospeché y resultó estar bien

Para que nadie lo vuelva a mirar. El port del motor contra el mockup, idéntico al
céntimo en los 8 meses y en ~20 000 combinaciones aleatorias. Ningún `Float` en
el esquema; las 10 columnas de dinero son `Decimal` con escala explícita. Ni un
`parseFloat` que pierda precisión. Ninguna cuota se guarda en vez de calcularse.
El `null` que borra un descuento no hereda el del mes anterior. Un monto que
llega como cadena no se concatena en el total. La cookie de sesión se firma con
`ADMIN_SECRETO`, no con el PIN, y no se puede falsificar ni alargar. Sin secretos
en el bundle del cliente. Inyección SQL, XSS, JSON de 10 MB y tipos equivocados:
todos 400, ninguno 500. El resembrado, cerrado con doble cerrojo. Cero rojo en
los estados de pago, cero «moroso/deudor/vencido», el agua celeste en todo, un
solo bloque noche por pantalla, ninguna animación en bucle. El `continue-on-error`
del CI no es un agujero: el paso de resumen cuenta los fallos y hace `exit 1`.
