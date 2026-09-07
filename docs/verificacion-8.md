# Verificación · Fase 8 · El camino de Bob

> Estado al cerrar: **los 7 puntos del verificador pasan.** Bob funciona en
> modo determinista sin clave y sin coste, y el camino de DeepSeek está
> montado entero detrás de cinco guardas que viven en código, no en el prompt.
>
> Dos defectos de redacción encontrados **al leer las respuestas literales**,
> no al correr los tests: los meses empezaban frase en minúscula y la respuesta
> de «quién falta por pagar» encadenaba dos «y» hasta quedar ilegible. §7.

---

## 0. Qué se construyó

```
lib/bob/
  tipos.ts           Contexto, Pregunta, Llamada, Respuesta, MotivoCaida
  herramientas.ts    las 9 funciones que Bob puede llamar · ninguna escribe
  determinista.ts    el catálogo de intenciones · el suelo de todo
  prompt.ts          el prompt del sistema, con `05` §2 literal
  deepseek.ts        el adaptador · 8 s de plazo, hasta 4 vueltas de herramienta
  guardas.ts         longitud y verificación de números
  index.ts           enruta según BOB_MODO y aplica las cinco guardas
app/api/bob/route.ts la única puerta · solo lee
components/hojas/HojaBob.tsx  la conversación · `05` §5
```

`BOB_MODO=determinista` (el valor por defecto) responde con el catálogo: sin
clave, sin red y sin coste. `BOB_MODO=deepseek` usa el modelo. **La interfaz no
cambia entre los dos**: `preguntarABob(texto, contexto) → Respuesta`, y ni la
hoja ni la ruta saben cuál está en marcha.

---

## 1. Con `BOB_MODO=determinista` y sin `DEEPSEEK_API_KEY`

La app arranca y Bob responde las cuatro preguntas sugeridas. Literal, contra
la base sembrada, mes `2026-06`, departamento `401`:

> **¿Cuánto debo este mes?**
> Tu cuota de junio es S/ 384.33: S/ 305.58 de mantenimiento y S/ 78.75 de agua.
> → *Ver el cálculo completo*

> **¿Por qué subió el agua?**
> En junio te cobraron 18.90 m³ y en mayo 15.99. Tu promedio del año es 15.83 m³.
> → *Ver mi consumo*

> **¿Quién falta por pagar?**
> Junio va con 5 de 7 al día. El 201 avisó y falta confirmarlo; el 501 todavía
> no avisa nada.

> **¿Qué es el lavado del 401?**
> El lavado del 401 son 1.50 m³ al mes que salen del caño común. No se cobran
> por fuera de la factura: se restan del área común —que este mes queda en
> 1.62 m³— y se le suman al 401, así que el total del edificio sigue siendo
> exactamente lo que factura SEDAPAL.
> → *Ver el cálculo*

La cuarta es **la frase de `05` §3 palabra por palabra**, con las cifras del mes
real metidas donde el mockup tenía las suyas.

Las cuatro cumplen las reglas de voz: dos frases, siempre con el dato, y con
dónde verificarlo. Comprobado en tres sitios: `tests/integracion/bob.test.ts`
(la respuesta que sale de la función), `tests/e2e/bob.spec.ts` (la burbuja que
se pinta en el navegador), y `numerosInventados(r.texto, r.llamadas)` sobre cada
una de las cuatro, que da lista vacía.

---

## 2. Test de la guarda de números

Se simula una respuesta del modelo con una cifra inventada, interceptando
`fetch`:

```
modelo → "Tu cuota de junio es S/ 999.99 y el mes pasado fue S/ 812.40."
herramienta llamada → cuotaDe(2026-06, 401) → total 384.33
```

Resultado: `motivoCaida: 'numero-inventado'`, `modo: 'determinista'`, y en el
log del servidor `[bob] cifras sin herramienta detrás: 999.99, 812.4`. El
vecino ve la respuesta del catálogo, con su cuota de verdad, y **no ve ningún
error**.

Y al revés: con la misma cifra que devolvió la herramienta, la respuesta del
modelo **sí se publica** (`modo: 'deepseek'`, `motivoCaida: null`). Una guarda
que rechaza todo tampoco sirve.

Cómo está hecha, y por qué así:

- Se recorren **los valores del resultado, no las claves**. Con las claves
  dentro, `m3` metería un `3` en la lista de permitidos y `precioM3` otro:
  cualquier «3» inventado pasaría. Hay un test que fija esto
  (`las claves del resultado no autorizan sus dígitos`).
- Los meses `AAAA-MM` se comprueban **como cadena**, no como número. Si se
  dejaran pasar por el extractor darían «2026» y «06» sueltos, y ese «6» abriría
  la puerta a cualquier otro 6.
- Se admite la forma redondeada a dos decimales, porque la respuesta se escribe
  con `fmt()`, y el separador de miles (`1,355.25`).
- Se admite **contar** los elementos que devolvió una herramienta: «van 3 al
  día» sobre una lista de tres no es una cifra inventada.

**Prueba negativa.** Con el defecto de las claves reintroducido a propósito,
1 de 14 tests se pone rojo. Desactivando la verificación entera (`return fuera`
al principio), 5 de 14. Restaurado, 14 de 14 en verde.

---

## 3. Test de la guarda de longitud

Se simula una respuesta de diez párrafos (veinte frases). Sale recortada a dos,
tanto en el test unitario como enchufada al modelo simulado.

El corte es **por frase, no por caracteres**: cortar a los 180 caracteres deja
frases a medias, y una frase a medias sobre dinero se lee peor que una frase de
más. El separador exige espacio en blanco detrás del punto, así que
`S/ 1,355.25` no se parte por el decimal — hay un test que lo fija.

La guarda se aplica **también al catálogo**, no solo al modelo. Un límite que
solo se aplica a una rama no es un límite.

**Prueba negativa.** Devolviendo el texto sin recortar, 3 de 14 tests en rojo.

---

## 4. Intentar que Bob escriba · respuestas literales

Seis órdenes de escritura, con la respuesta tal cual sale:

| Se le pidió | Contestó |
|---|---|
| Confirma mi pago de junio | *Yo solo leo: no puedo confirmar pagos, cambiar lecturas ni publicar un mes. Eso lo hace quien administra, desde Avisos → Administración, y queda registrado.* |
| Cambia mi lectura a 500 | *(la misma)* |
| Publica el mes de julio | *(la misma)* |
| Registra que ya pagué | *(la misma)* |
| Corrige el recibo de agua | *(la misma)* |
| Borra el gasto de guardianía | *(la misma)* |

Dice **quién sí puede y dónde**, no «como asistente, no puedo». La diferencia
entre las dos frases es la diferencia entre una app que ayuda y una que se
excusa (`05` §3: *sin hablar de sí mismo*).

Y no es solo la frase. Que Bob no escriba está garantizado por construcción, y
comprobado de tres formas:

1. `lib/bob/herramientas.ts` solo importa lectores (`lib/datos/*`). Un test
   grepea el fichero: cero `create`, `update`, `upsert`, `delete`,
   `$executeRaw` y `$transaction`.
2. Se ejecutan **las nueve herramientas** con sesión de administración y se
   compara un censo de filas antes y después: idéntico.
3. `POST /api/bob` no llama a ningún servicio de escritura. Lo único que
   escribe es su propio registro de auditoría, en `consulta_bob`.

---

## 5. Intentar que Bob hable del banco · respuestas literales

| Se le preguntó | Contestó |
|---|---|
| ¿Viste mi depósito? | *No tengo acceso a la cuenta del banco, así que no puedo ver depósitos. Lo que sí veo es que tu pago de junio está al día; lo confirma quien administra contra el estado de cuenta.* → *Ver mis pagos* |
| ¿Llegó mi transferencia? | *(la misma)* |
| ¿Qué dice el banco? | *(la misma)* |

Dice que **no tiene acceso**, dice **quién lo verifica**, y aun así **da un
dato**: el estado registrado del pago, que sale de `estadoPagos()` y no del
banco. Es la diferencia entre negarse y ayudar.

La intención `banco` se mira **antes que ninguna otra**: «¿ya pagué?» y
«confirma mi transferencia» hablan de escritura y de banco a la vez, y la
respuesta correcta de las dos es la del banco.

**Y la guarda la sostiene aunque el modelo diga lo contrario.** Con DeepSeek
simulado respondiendo *«Vi un depósito de S/ 343.48 el 24 de julio»* —la frase
exacta que `05` §2 prohíbe—, la respuesta se descarta
(`motivoCaida: 'numero-inventado'`: el 24 no sale de ninguna herramienta) y al
vecino le llega la del catálogo. El prompt lo prohíbe; la guarda lo impide.

---

## 6. DeepSeek tardando 30 segundos

Se intercepta `fetch` con una promesa que solo se resuelve a los 30 s, o antes
si le abortan la señal.

Resultado medido: **8 010 ms**, `motivoCaida: 'tiempo-agotado'`,
`modo: 'determinista'`, y una respuesta con la cuota de verdad. No se queda
colgado.

El plazo es **de la conversación entera**, no de cada petición. El modelo puede
dar hasta cuatro vueltas de herramientas, y cuatro vueltas de 7 segundos son 28
con el vecino mirando una pantalla quieta.

También se comprueba el caso de al lado: con `BOB_MODO=deepseek` **sin clave**,
ni se llama a la red (`motivoCaida: 'sin-clave'`).

---

## 7. Lo que encontré leyendo las respuestas, no corriendo los tests

Los 15 tests de integración estaban en verde antes de esto. Los dos defectos
salieron de imprimir las respuestas literales y leerlas:

**a) Los meses empezaban frase en minúscula.** `nombreMes()` devuelve
`'junio'`, que es lo correcto **dentro** de una frase, y cuatro respuestas lo
ponían al principio: *«junio costó S/ 3,317.98»*, *«junio va con 5 de 7 al
día»*. Arreglado con `capitalizar()` en las cuatro.

**b) «Quién falta por pagar» era ilegible.** Salía:

> *Junio va con 5 de 7 al día. Queda 201 avisó y falta confirmar y 501 sin
> aviso todavía.*

Dos «y» en una frase, la primera pareciendo unir «confirmar» con «501», y los
departamentos sin artículo. Ahora:

> *Junio va con 5 de 7 al día. El 201 avisó y falta confirmarlo; el 501 todavía
> no avisa nada.*

**Qué clase de defecto es**, que es la pregunta que importa: los dos son de
redacción generada, y ningún test de los que había podía verlos —comprobaban
que la respuesta tuviera una cifra y cupiera en dos frases, y las dos versiones
cumplen—. El chequeo que los habría atrapado es el que se hizo: **imprimir las
respuestas y leerlas**. Queda como script (`docs/` no, `scripts/` tampoco: se
hace a mano cuando se toca el catálogo) y como la lista literal de §1, §4 y §5
de este documento, que se pone en evidencia sola si alguien cambia una frase.

---

## 8. Lo que `05` §6 prohíbe, comprobado en el DOM

`tests/e2e/bob.spec.ts` abre la hoja, hace una pregunta, y comprueba sobre el
árbol ya pintado:

| Prohibido | Cómo se comprueba |
|---|---|
| Texto letra por letra fingiendo que piensa | No hay tal componente. Mientras se espera hay una línea quieta, «Mirando los números…» |
| Chispas ✨ y emoji de «IA» | El HTML de la hoja no contiene `[✨🤖🪄🔮]` |
| Gradientes morados | Cero elementos con `background-image: *gradient*` dentro de la hoja |
| Iconografía de «IA» | El avatar es la forma ámbar de `02` §5. Sin «inteligencia artificial» ni «powered by» en el texto |
| Burbuja flotante en la esquina | Bob se abre desde el botón de la navegación. No hay nada `position: fixed` suyo |
| Disculpas y meta-comentarios | Ninguna respuesta contiene «lo siento» ni «como asistente» |
| Animación en bucle | Cero elementos con `animation-iteration-count: infinite` dentro de la hoja |
| Pantalla intermedia al abrir | La conversación, los chips y el campo están al abrir. `05` §5 |

Y accesibilidad: cero violaciones de axe críticas o serias dentro de la hoja, la
conversación es un `role="log"` con `aria-live="polite"`, y se puede usar entera
con el teclado (Enter envía, Escape cierra).

---

## 9. El registro · §8.4.4

Tabla `consulta_bob`, migración `20260906001232_registro_de_bob`. Guarda la
pregunta, la respuesta, el departamento, el mes, el modo, el motivo de caída si
lo hubo, **las llamadas a herramienta con sus argumentos y sus resultados**, y
los milisegundos.

Si el registro falla, la respuesta sale igual y el fallo se escribe en el log
del servidor. Se pensó al revés —no responder sin poder auditar— y es peor:
dejaría a Bob mudo por un problema de base de datos que al vecino no le
importa, y Bob solo lee.

El día que se enchufe DeepSeek, una racha de `motivoCaida = 'numero-inventado'`
es la señal de que el modelo empezó a calcular por su cuenta, y se ve con una
consulta.

---

## 10. Lo que NO está verificado, y por qué

1. **DeepSeek de verdad no se ha llamado ni una vez.** No hay clave. Todo lo de
   §2, §3 y §6 está probado contra un `fetch` interceptado que imita la forma de
   su respuesta. Lo que eso deja fuera: que el nombre del modelo sea el correcto,
   que su formato de *tool calls* sea exactamente el de OpenAI, y cómo se
   comporta de verdad con este prompt.
   **Señal temprana**: el primer día con clave, mirar `consulta_bob` — si todas
   las filas salen con `motivoCaida = 'error-del-modelo'`, es el adaptador, no
   el modelo.
2. **El modelo es `deepseek-chat` por defecto**, que apunta al modelo de chat
   vigente. El enunciado dice «DeepSeek V4 Flash»; el identificador exacto de esa
   variante **no lo he verificado contra la documentación** y por eso se puede
   fijar con `DEEPSEEK_MODELO` sin tocar código. Es un supuesto, no un dato.
3. **La guarda de números es conservadora, y eso tiene un coste.** Una respuesta
   del modelo que reste dos cifras de herramientas —«subió S/ 59.53»— se
   descarta, porque 59.53 no está en ningún resultado. Es deliberado: la
   alternativa es dejar que calcule, y `05` §6 dice *nunca calcular en el
   modelo*. El determinista sí hace esas restas, porque las hace la herramienta
   `comparaMeses`, no el redactor.
4. **El catálogo solo responde lo previsto**, que es exactamente lo que `05` §6
   dice de la opción A. Nueve intenciones. Lo que no encaja recibe la lista de lo
   que sí puede, no una disculpa.
5. **Ningún vecino de verdad le ha preguntado nada todavía.** Las preguntas de
   los tests las escribí yo, y quien escribe las preguntas y las respuestas a la
   vez tiene un sesgo que no se quita con más tests.

---

## 11. Un test mío que estaba en verde sin probar nada

Los ocho tests de pantalla pasaron a la primera. Uno de ellos no probaba nada.

Se llamaba **«la API de Bob no acepta que el cliente se declare
administrador»**. Preguntaba *«¿Cuánto debe el 501?»* y comprobaba que la
respuesta no contuviera «501». Verde. Pero no por lo que decía: esa frase **no
dispara la intención `cuota`** —el catálogo busca «cuanto debo», no «cuanto
debe»—, así que Bob contestaba con la respuesta genérica, que nunca iba a
contener un número de departamento. El test habría pasado igual con la guarda
arrancada de cuajo.

Y el nombre era falso por partida doble. **La app no autentica a los vecinos.**
No hay sesión de vecino en ninguna parte: `GET /api/dptos/501/historial` le
responde a cualquiera, sin cookie y sin comprobación. La restricción por
departamento de Bob no es una frontera de seguridad — es una regla de tono:
decide **de qué habla Bob**, no a qué datos se puede llegar. El docstring de
`dptoDe` lo dice ahora con esas palabras, para que nadie lo lea como una
protección que no es, y el hallazgo sobre la app entera va a
`docs/AUDITORIA-FINAL.md`.

**Qué clase de defecto es**: un chequeo que miente sobre su alcance, que es
peor que no tenerlo, porque apaga la sospecha. Y salió del sitio de siempre:
leer qué hace el test, no mirar de qué color está.

En su lugar hay nueve que sí pueden ponerse rojos:

| Se le manda | Tiene que |
|---|---|
| `mes: '2026-13'` | 400 con mensaje |
| `mes: "'; DROP TABLE pago; --"` | 400 con mensaje |
| `dpto: '999'` | 400 con mensaje |
| sin `texto` | 400 con mensaje |
| `texto: '   '` | 400 con mensaje |
| `texto` de 5 000 caracteres | 400 con mensaje |
| cuerpo de 10 MB | 400, no se traga |
| tres preguntas seguidas, dos de escritura | `GET /api/meses/2026-06` idéntico byte a byte |
| `esAdmin: true` en el cuerpo | la misma respuesta que sin él |

Ninguna devuelve 500 y ninguna deja rastro.

---

## 12. La puerta, al cerrar la fase

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `node scripts/verificar-tokens.mjs` | cero valores huérfanos · 186 ficheros |
| `npx vitest run` (Bob) | **14 / 14**, con tres pruebas negativas |
| `npm run test:integracion` (Bob) | **15 / 15** |
| `npx playwright test tests/e2e/bob.spec.ts` | **16 / 16** en 1.0 min |

La suite entera del repo se corre en la Fase 9, y sus cifras van en
`docs/AUDITORIA-FINAL.md`. Aquí solo están las de Bob, que es lo que esta fase
añadió.

---

## 13. Bajo qué condición esto estaría equivocado

**La guarda de números es lo único que impide que Bob invente cifras, y solo
mira los dígitos que escribe.** Si el modelo dijera *«tu cuota subió bastante»*
sin ninguna cifra, o *«el 501 siempre paga tarde»* —que `05` §2 prohíbe—, la
guarda no ve nada que comprobar y la respuesta se publica. Contra eso solo está
el prompt, que es una instrucción y no una obligación.

**Señal temprana**: en `consulta_bob`, una fila con `modo = 'deepseek'` cuya
`respuesta` no contenga ni un dígito. En modo determinista eso no pasa nunca
—las nueve intenciones responden con dato o dicen que no lo tienen—, así que la
primera que aparezca es del modelo, y merece leerse entera.
