# CLAUDE.md

Instrucciones para trabajar en este repositorio. Léelo entero antes de tocar
nada: casi todo lo de aquí existe porque romperlo ya costó caro una vez.

Para entender **qué es el proyecto**, el README. Para entender **cómo se llegó
hasta aquí y qué está decidido**, `docs/HANDOFF.md`.

---

## 1. Lo primero: cómo se trabaja aquí

Este proyecto lo usan siete familias para saber cuánto deben pagar. **Un número
mal no es un bug: es una factura equivocada**, y destruye la confianza en todos
los demás números de la pantalla. El método está calibrado para eso.

### Lo verde no es evidencia

Casi todos los defectos graves de este repositorio pasaron por un build exitoso,
una suite en verde y un lint callado. Si tu criterio para cerrar es que los
chequeos pasen, vas a cerrar sobre defectos.

- **Verifica ejecutando, no leyendo.** Corre el código en vez de revisarlo.
  Recalcula la cifra desde la fuente cruda en vez de confiar en la que ves.
  Leer tu propio código buscando errores es el peor detector disponible: ya sabes
  qué querías que dijera, así que lo lees como si lo dijera.
- **Busca el artefacto.** ¿El fichero que tenía que cambiar, cambió? ¿La cifra
  que tenía que moverse, se movió? Un proceso que sale con código 0 no prueba que
  hizo su trabajo.
- **Prueba varios puntos del espacio, no uno.** Los defectos viven en los bordes:
  un mes vacío, un solo dato, el primer mes de la serie, un mes sin publicar, una
  cuota en cero.

### La prueba negativa es obligatoria

**Un chequeo que nunca viste fallar no es un chequeo: es una decoración.**

Después de escribir cualquier test o validación, **reintroduce a propósito el
defecto que dice atrapar** y confirma que da rojo. Después restáuralo y confirma
que vuelve al verde. Sin excepción, y sobre todo cuando el test te salga verde a
la primera.

Si el defecto es de una clase que ya está cubierta, añade la inyección a
`scripts/prueba-negativa.mjs` (motor y reglas de lectura) o a
`scripts/prueba-negativa-integracion.mjs` (servicios y datos).

### Cuando aparezca un defecto tuyo

1. Decláralo primero, antes de explicar.
2. Dimensiona qué afecta: qué cifras, qué pantallas, desde cuándo.
3. Corrígelo.
4. **Añade el chequeo que lo habría atrapado**, y pásale la prueba negativa.
5. Pregunta de qué **clase** es, no solo cuál era. Si es de una familia, cubre la
   familia entera.
6. Y deja de disculparte. Un error declarado, dimensionado y cubierto es trabajo
   bien hecho.

### Al cerrar

Di el estado real. Si ocho de nueve chequeos están en verde, di *ocho de nueve* y
por qué el noveno no. «Todo listo» con un rojo conocido es una mentira pequeña
que cuesta caro la próxima vez. Y al final: **bajo qué condición esto estaría
equivocado, y cuál sería la señal temprana.**

---

## 2. Las reglas que no se negocian

Romper cualquiera de estas no es una decisión técnica que puedas tomar solo.

1. **Nunca se guarda una cuota calculada.** Se guardan las entradas y se calcula
   al vuelo. Única excepción: `Cierre.instantanea`, que existe para que el aviso
   «tu cuota pasó de X a Y» sea verificable, y **no se lee para calcular nada**.

2. **Nunca `Float`.** Todo monto es `Decimal` con precisión explícita. La
   conversión a `number` ocurre **solo** en `lib/datos/decimal.ts`. Un
   `.toNumber()` fuera de ahí es un bug.

3. **Toda escritura deja rastro en `Auditoria`**, en la misma transacción.
   Y **solo se avisa sobre meses publicados**.

4. **Los meses publicados no se tocan** salvo por la ruta de corrección, que
   recalcula, exige que siga cuadrando y avisa a los siete.

5. **Nada inventado en lo que ve el vecino.** `monto: null` es *por confirmar*;
   `monto: 0` es *cuesta cero*. Son cosas distintas y se muestran distinto.
   Cuando algo no se pudo medir, el estado vacío es la respuesta correcta, y hay
   que distinguir *cargando*, *error* y *vacío*.

6. **Ningún color ni tamaño escrito a mano.** Todo sale de los tokens de
   `app/globals.css`. `scripts/verificar-tokens.mjs` revienta si aparece un
   `#fff` suelto —incluido dentro de un test—. Si de verdad hace falta una
   excepción, se añade acotada al verificador y con su motivo escrito.

7. **Una sola copia de cada regla.** Ya pasó dos veces que una regla se duplicó
   —la herencia del lavado— y las copias se separaron sin que nada se pusiera
   rojo. Las reglas de lectura viven en `lib/datos/filas.ts` y las usan los dos
   caminos: la lectura por transacción y la foto del edificio.

8. **`mockup/**/support.js` no se mira y no se porta.** Lo dice el encargo.

### Decisiones de producto ya tomadas

No las reabras sin que el usuario lo pida:

- **No hay roles.** Cualquiera puede entrar a administración con el PIN.
- **No hay layout de dos columnas en escritorio.** La app es un marco de 390 px
  centrado, también en pantalla grande.
- **Teclado numérico propio**, no el del sistema, para las cifras.
- **Ningún rojo en un estado de pago.** Ni la palabra «deuda». Lo pendiente se
  dice en ámbar y en suave.

---

## 3. Convenciones de código

- **Todo en español**: nombres de variables, de funciones, de ficheros, de tests,
  y los mensajes de commit.
- **Los comentarios explican el *porqué*, no el *qué*.** El patrón de este
  repositorio es un docstring que cuenta **qué se rompió** y cómo se arregló:

  ```ts
  /**
   * Los m³ de **este** mes, no los de hoy.
   *
   * Si el mes tiene un valor congelado, manda ese: se grabó al publicarlo y es
   * con el que se calcularon las siete cuotas que la gente ya vio. Sin esta
   * línea, subir el consumo del lavado de 1.50 a 3.00 movía la cuota del 401 en
   * junio de 2026 en S/ 6.25 —un mes cerrado y avisado— mientras el aviso a los
   * siete decía que los meses cerrados no se tocan.
   */
  ```

  Escribe así. Un comentario que solo repite el nombre de la función sobra.
- **Los textos de la interfaz salen de `lib/copys.ts`**, no escritos en el JSX.
- **TypeScript estricto.** Nada de `any`. Un `as` necesita un comentario que
  diga por qué es seguro.
- No añadas dependencias sin necesidad real.

---

## 4. Antes de dar algo por terminado

```bash
npm run verify            # tipos + tokens + documentos + 502 de unidad  (~30 s)
npm run test:integracion  # 197 tests contra Postgres              (~75 s)
npm run test:e2e          # 167 tests de pantalla                  (~4 min)
```

Y si tocaste el motor, las reglas de lectura, los servicios o la capa de datos,
**también las pruebas negativas** (son lentas, ~25 min cada una; lánzalas en
segundo plano):

```bash
npm run prueba-negativa                        # 18 defectos · motor y reglas
node scripts/prueba-negativa-integracion.mjs   # 17 defectos · servicios y datos
```

Y si tocaste el README, `CLAUDE.md` o el handoff —o moviste un fichero que
citan— comprueba que siguen diciendo la verdad, que es rápido:

```bash
npm run verificar-docs
node scripts/verificar-docs.mjs --prueba-negativa   # los 6 defectos, ~1 s
```

Corre la puerta entera y **que no corte en el primer rojo**: un paso rojo que
esconde a los otros ocho es lo peor de los dos mundos. Reporta el resumen
completo.

---

## 5. Trampas de este entorno

Estas ya costaron tiempo. No vuelvas a caer.

- **`pkill -f "patrón"` se mata a sí mismo** (sale con 144) porque el patrón
  aparece en su propia línea de comando. Usa el truco del corchete —`[p]atrón`—
  o, mejor, mata por PID.

- **Las pruebas negativas escriben defectos en el árbol de trabajo real.** Si las
  matas a mitad, o si un proceso huérfano sobrevive, **se quedan puestos**.
  Después de interrumpir una, comprueba siempre:

  ```bash
  git status --short && grep -rn "defecto inyectado" lib/
  ```

  Para no arriesgar el árbol, córrelas en un worktree aparte:

  ```bash
  git worktree add -f /tmp/pn-arbol <rama>
  ln -sfn "$PWD/node_modules" /tmp/pn-arbol/node_modules
  ```

- **Un script de edición que aborta a mitad puede perder *todas* las ediciones de
  esa llamada**, no solo la que falló, si escribe el fichero al final. Verifica
  con `git diff` después de cada tanda.

- **Playwright no intercepta las peticiones del service worker.** Para probar el
  modo sin conexión hay que usar `context.setOffline(true)`, no `page.route`.

- **En `next start`, cualquier POST vacía la caché de datos del proceso.** Eso
  hace que un chequeo de invalidación de caché dé verde aunque la invalidación
  esté arrancada de raíz. En Vercel no pasa. Está contado en
  `tests/integracion/invalidar-cache.test.ts`.

- **Medir la app sin la cookie `sb_dpto` mide el onboarding**, que no toca la
  base. Una medición de rendimiento sin sesión no vale nada.

- **Chromium** está en `/opt/pw-browsers/`. No corras `playwright install`.

---

## 6. Git

- Commits en español, con cuerpo. El título dice **qué cambió para el usuario**,
  no qué fichero se tocó. El cuerpo dice **qué se rompió y cómo se supo**.
- No crees un pull request salvo que te lo pidan.
- No hagas merge a `main` sin permiso explícito.
