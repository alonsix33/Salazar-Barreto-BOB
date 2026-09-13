# Bob, todas sus apariciones

Auditoría de dónde habla Bob, cuándo se activa, qué dice y quién escribe lo que
dice. Hecha porque no existía: los textos estaban repartidos por siete ficheros
y no había forma de responder «¿cuándo habla Bob?» sin leerlos todos.

## El resumen

Bob habla en **ocho sitios**. Uno es una conversación y siete salen solos.

| # | Dónde | Cuándo | Quién redacta |
|---|---|---|---|
| 1 | Hoja de Bob | cuando el vecino pregunta | DeepSeek, con el catálogo de suelo |
| 2 | Inicio, bajo la cuota | siempre | catálogo, y DeepSeek lo reescribe |
| 3 | Mi departamento, bajo la tira del año | siempre | catálogo, y DeepSeek lo reescribe |
| 4 | Cierre, paso 1 | consumo de un dpto sobre el doble de su promedio | catálogo, y DeepSeek lo reescribe |
| 5 | Cierre, paso 1 | lectura menor que la anterior, o salto desproporcionado | **solo el catálogo** |
| 6 | Cierre, paso 2 | siempre que hay recibo de agua | catálogo, y DeepSeek lo reescribe |
| 7 | Cierre, paso 3 | siempre que hay monto de luz | catálogo, y DeepSeek lo reescribe |
| 8 | Cierre, paso 4 | hay un concepto sin monto confirmado | catálogo, y DeepSeek lo reescribe |

Los siete automáticos viven en `lib/bob/momentos.ts`, uno al lado del otro, cada
uno con su condición de disparo escrita. Ese fichero **es** esta tabla, y es el
que hay que tocar para agregar un octavo.

## Las dos formas de hablar, y por qué no son iguales

**En la hoja, el vecino preguntó.** Sabe que está esperando, así que se espera:
se le pide al modelo, se le dan herramientas para que consulte la base, y hasta
ocho segundos. Si falla, contesta el catálogo.

**En los otros siete, nadie preguntó.** Así que no se espera nunca. El catálogo
se pinta en el servidor y llega con la página; por detrás se le pide al modelo
la misma frase mejor dicha y, si llega, **se cambia en su sitio**. Sin estado de
carga, sin hueco reservado, sin salto de maquetación. Si el modelo tarda, se
cae, se calla o escribe una cifra que no le dieron, la pantalla se ve
exactamente igual de bien, porque lo que había ya era correcto.

Por eso el texto del catálogo no es relleno. Es la respuesta.

## La que no pasa por el modelo

La propuesta de corrección de una lectura (#5) es la única. No es una excepción
por pereza: lo que dice lleva la lectura tecleada, la anterior y la propuesta
con tres decimales, y justo debajo hay dos botones que escriben **exactamente
esa cifra**. Un texto redactado de nuevo, aunque fuera correcto, podría describir
un número distinto del que el botón va a guardar, y ahí no hay guarda que valga:
los dos números existirían.

Está declarado con `mejorable: false` y hay un test que lo comprueba, incluido
uno que verifica que ni siquiera se abre la conexión.

## Las guardas, que son las mismas en los ocho sitios

1. **Dos frases.** `aDosFrases`, venga de donde venga el texto.
2. **Ninguna escritura.** `herramientas.ts` solo importa lectores, y el camino
   automático no tiene herramientas siquiera.
3. **Ninguna cifra inventada.** `numerosInventados`. En la hoja se verifica
   contra las herramientas que llamó; en los automáticos, contra los datos que
   la pantalla ya calculó **y contra el texto que ya se está viendo**.
4. **Registro completo.** Todo va a `consulta_bob`, los automáticos con
   `pregunta = "[momento] <id>"`. Antes, lo que Bob decía solo en la pantalla no
   quedaba en ningún sitio y no se podía auditar.
5. **Tiempo de espera.** Ocho segundos, y después el catálogo.

### El detalle del punto 3 que costó encontrar

Las cifras permitidas incluyen las del **texto del catálogo**, no solo las de
los datos. Hace falta porque el catálogo deriva: «es tu mes más alto del año,
5.40 m³ sobre tu promedio» sale de 17.40 menos 12.00, y ni el 5.40 ni el 5.4
están en los datos. Sin eso, el modelo no podía decir lo mismo que ya estaba en
pantalla sin que la guarda le tirara la respuesta entera.

Lo encontró un test. Por fuera se habría visto perfecto: la app funcionando, el
modelo conectado, y todas sus respuestas descartadas en silencio.

Y no afloja la guarda. Lo que se permite es una cifra que el vecino **está
viendo en ese mismo párrafo**. Lo que sigue prohibido es una cifra de origen
desconocido.

## Cómo se prueba

- `lib/bob/__tests__/momentos.test.ts` — que los textos sin modelo son los de
  antes de moverlos, palabra por palabra, y que cada uno pasa su propia guarda.
- `tests/integracion/bob-momentos.test.ts` — el camino entero con un DeepSeek
  simulado: lo bueno se acepta, lo largo se recorta, y los cinco modos de fallo
  (cifra inventada, mes inventado, respuesta vacía, error de la API, red caída)
  devuelven `null` y dejan la pantalla como estaba.
- `tests/integracion/bob-sabe-del-edificio.test.ts` — los doce procedimientos y
  el directorio de vecinos.
- `tests/e2e/bob.spec.ts` — que los globos aguantan una respuesta larga y un
  número sin espacios, a 320, 390 y 430 px.

## Qué puede leer Bob, y qué puede calcular

Bob **no toca la base directamente**. Llama a herramientas de solo lectura, que
son las mismas funciones de `lib/datos/*` que usan las pantallas, así que lo que
dice y lo que se ve salen del mismo sitio por construcción. Son catorce:

| Herramienta | Para qué |
|---|---|
| `calcularMes` | el mes entero: total, agua, área común, si cuadra |
| `cuotaDe` | la cuota de un departamento, con su desglose |
| `consumoDe` | su consumo de agua mes a mes |
| `serieSaldo` | la cuenta conjunta: recibido, gastado, acumulado |
| `estadoPagos` | quién pagó, quién avisó, quién no, con fechas y hoy |
| `balanceDe` | lo que trae a favor o le falta, acumulado |
| `gastosDe` | los conceptos del mes, y **quién paga** cada gasto puntual |
| `historialPagos` | los meses cerrados con su cuota, estado y fecha |
| `datosDeLaCuenta` | banco, número, CCI, titular, día de vencimiento |
| `comparaMeses` | qué cambió entre dos meses y por qué |
| `explicaLavado` | los m³ del lavado y de dónde salen |
| `quienVive` | los siete, con nombre, piso y porcentaje |
| `comoSeHace` | el procedimiento de un caso concreto |
| `mesesDisponibles` | qué meses están publicados |

**Ninguna escribe.** No es una convención: el módulo solo importa lectores, y
hay un test que comprueba que ahí no aparece un `create`, `update` ni `delete`.

### Calcular no es inventar

La guarda rechazaba **cualquier** cifra que no estuviera literalmente en un
resultado, y eso le quitaba a Bob la mitad de lo que lo hace útil: «¿hace
cuántos días que no paga el 501?» es una resta entre la fecha del último pago y
hoy, y con la guarda a secas esa respuesta correcta se descartaba.

Ahora se permite lo que se **deriva** de cifras del sistema: sumas, restas,
porcentajes, múltiplos y los días entre dos fechas. Sigue prohibido lo que no se
puede construir así, que es lo que importa: si Bob dice que la guardianía cuesta
S/ 1,800 y el sistema dijo 1,625, no hay cuenta que lo produzca.

Dos detalles que costaron encontrar, los dos con su test:

- **Las cuentas se hacen con las cifras crudas**, no con sus variantes de
  escritura. Con las variantes dentro, de 8.42 y 5.11 salían el 8 y el 5, y de
  ahí un 3 por resta: «son 3 metros» pasaba sin que nadie hubiera dicho 3.
- **Las derivadas no se redondean al entero.** Los enteros chicos son los
  peligrosos, porque hay pocos y cualquier cuenta los produce.

Medido: con seis cifras de origen se cuela el 0.01 % de las cifras al azar; con
un resultado grande de ~30, el 0.20 %. Hay un test que lo mide y falla si sube
del 1 %.

## Quién recibe qué, y el hilo

Cada pregunta lleva su departamento —de la cookie— y la respuesta vuelve en la
misma respuesta HTTP, al navegador que preguntó. No hay buzón compartido: si el
401 y el 202 preguntan a la vez son dos peticiones independientes, y en
`consulta_bob` quedan las dos con su departamento.

El **hilo lo guarda el navegador** y lo manda con cada pregunta, hasta seis
turnos. Por eso cada vecino tiene su conversación sin que exista sesión de
vecino en ninguna parte: la memoria está en su pantalla. Sin esto, «¿y el mes
pasado?» no tenía con qué resolverse.

El catálogo determinista **no usa el hilo**, y es una limitación conocida:
resuelve por palabras de la pregunta actual, y un catálogo que adivina de qué se
hablaba se equivoca de tema con cara de certeza.

## Lo que sigue sin estar

- **Sin caché.** Cada vez que se pinta uno de los siete se le pregunta al
  modelo. Para siete departamentos es barato, pero con el cierre abierto y
  tecleando lecturas se piden varias por minuto. Si el gasto molesta, lo que
  toca es cachear por momento y huella de datos, no quitar la funcionalidad.
- **Sin métrica de cuántas se descartan.** Está en `consulta_bob` y se puede
  contar, pero nadie lo mira. Si el modelo empieza a inventar cifras, hoy nos
  enteramos leyendo la tabla.
