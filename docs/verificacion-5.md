# Verificación · Fase 5 · El cierre del mes y el resto del panel

> Estado al cerrar: **10 de 10 puntos del verificador pasan**, y después de eso
> tres verificadores adversarios encontraron **veintitantos defectos más**, la
> mitad de ellos en los propios chequeos. Está todo en §13, y no es un apéndice:
> es la parte de esta fase donde más se aprendió.
>
> El más caro: cambiar los m³ del lavado desde el panel movía las cuotas de los
> **meses ya publicados** —S/ 6.25 en la de junio del 401— mientras el aviso a
> los siete decía que los meses cerrados no se tocan.
>
> Al final, §11, lo que queda declarado y no arreglado.

---

## 0. La puerta completa, sin cortar en el primer rojo

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `node scripts/verificar-tokens.mjs` | cero valores huérfanos · 157 ficheros, 16.097 líneas |
| `npx vitest run` | **261 / 261** |
| `npm run test:integracion` | **80 / 80** (Postgres real) |
| `node scripts/prueba-negativa.mjs` | **12 / 12** defectos de motor detectados |
| `node scripts/prueba-negativa-integracion.mjs` | **8 / 8** defectos de servicio detectados |
| `npx playwright test` | **96 / 96** |
| `npm run build` | compila |

Los 96 de Playwright incluyen los cuatro nuevos de esta fase: la propuesta de
corrección aceptada, el caso de dos sospechosas, la corrección de un mes
publicado, y la descarga del Excel leída de vuelta con ExcelJS.

---

## 1. Playwright, el flujo completo, del paso 0 al 7

`tests/e2e/cierre.spec.ts` recorre los siete pasos con los datos reales de julio
—las siete lecturas, el recibo de SEDAPAL (81 m³ · S/ 338.60), la luz común
(S/ 361.20), los gastos fijos, nada puntual, revisión y publicar— y compara las
siete cuotas **al céntimo** con lo que devuelve el motor de la Fase 1:

| Dpto | Cuota de julio |
|---|---|
| 101 | 381.83 |
| 201 | 342.85 |
| 202 | 683.54 |
| 301 | 371.02 |
| 401 | 388.96 |
| 501 | 535.69 |
| 502 | 663.70 |
| **Total del mes** | **3,374.38** |

### Tres cifras cruzadas a mano, con calculadora aparte

No contra el motor: **desde el papel**, con `python3` y aritmética decimal.

| Cifra | A mano, desde el recibo | La app |
|---|---|---|
| Total del mes | `1625 + 680 + 208.33 + 50 + 48.75 + 32.50 + 30 + 361.20 + 338.60` = **3374.38** | 3,374.38 |
| Mantenimiento del 101 | `round(3035.78 × 11.72) / 100` = **355.79** | 355.79 |
| Agua del 101 | `round2(6.23 × 338.60/81)` = **26.04** | 26.04 |

La tercera salió **26.05 en el primer intento**, y el desvío enseñó algo: usé el
consumo sin redondear (`186.461 − 180.23 = 6.231`). El motor redondea el consumo
a dos decimales **antes** de multiplicar por el precio del m³, como manda el
orden de redondeos de `01` §9. Con `6.23` da 26.04 y coincide. Es la
demostración de que el orden de los 16 redondeos no es cosmético: mueve
céntimos en la cuota de una persona.

---

## 2. Salir a mitad y volver

`se sale a mitad y se vuelve al mismo paso, con los datos escritos`: se escribe
una lectura en el paso 1, se **recarga la página entera** —no se cierra la hoja,
se recarga— y al volver a entrar el contador sigue en `1 / 7` y la lectura
`186.461` está en pantalla.

El paso vive en la base, no en el navegador, porque el administrador puede
cambiar de teléfono. Ninguna escritura de los pasos 1 a 6 genera aviso: nada
está publicado todavía.

---

## 3. Forzar que no cuadre

`con una lectura que no cuadra, el paso 6 bloquea la publicación`: se escriben
las siete lecturas con una que hace retroceder el medidor. El paso 6 no deja
publicar y dice qué no cuadra. El botón de avanzar **nunca se pone gris y se
calla**: su tipo obliga a pasar `motivoBloqueo`, así que un botón bloqueado sin
explicación no compila.

---

## 4. La corrección de tecleo · el defecto que el motor no podía ver

**Estaba muerta.** El motor de `01` §8 llevaba desde la Fase 1 probado contra el
mockup —90 tests de fidelidad, todos verdes— y la propuesta **no aparecía nunca
en la aplicación**.

La causa es de orden, no de cálculo. La regla descarta candidatas comparando
contra dos cosas que en el paso 1 todavía no existen: los m³ que facturó SEDAPAL
—que se escriben en el paso 2— y la suma de los otros seis medidores. Preguntada
en el paso 1, `objetivoM3` vale 0, la diferencia sale negativa para toda
candidata y no sobrevive ninguna. Medido:

```
propuestas con objetivoM3 = 0: 0 de 11.329 lecturas
```

Es exactamente la familia de defecto que el método llama *chequeo que nunca viste
fallar*: código correcto, tests verdes, y una función que en producción devuelve
`null` siempre.

**El arreglo.** El motor no se toca —es regla de cálculo, y es literal—. Se
arregla *cuándo* se pregunta:

- `lib/calculo/correccion.ts` gana `revisarLecturas()`, que **exige las siete
  lecturas y el recibo** y devuelve `null` con menos. Es honesto: con menos, la
  regla de §8 no se puede evaluar.
- El **paso 2** enseña la propuesta en cuanto se escriben los m³. Es el primer
  instante del cierre en que la regla es evaluable.
- El **paso 1** la conserva para cuando se reedita una lectura con el recibo ya
  puesto (el administrador que vuelve).

`04` dibuja la propuesta en el paso 1 y aquí sale también en el paso 2. No es una
licencia de diseño: es el único sitio donde la regla que el propio documento
manda aplicar tiene los datos que necesita.

### Los cuatro casos del verificador, con los datos reales de julio

| Caso | Qué hace | Dónde |
|---|---|---|
| Dos dígitos transpuestos (401: `483.038` en vez de `438.038`) | **La propone**, con la frase del documento | e2e + unitario |
| Dos correcciones posibles a la vez (401 y 101 mal) | **Se calla** | e2e + unitario |
| Lectura menor que la anterior | Nunca propone un valor por debajo del medidor anterior | unitario |
| Las siete bien | **Se calla** | unitario |

### La frase, y por qué no está escrita fija

`04` la enseña así:

> *«¿Será 438.038? Con 483.038 el consumo sería 62.40 m³, cuatro veces tu
> promedio, y el edificio pasaría de lo que facturó SEDAPAL.»*

Hay un test que compara esa frase **carácter a carácter** con la que produce la
app para ese caso. Pero no se escribe fija: las dos razones que enumera no son
ciertas siempre. Una lectura también puede fallar por quedarse **corta** contra
la factura, o por retroceder el medidor. Un aviso que afirma lo que no pasó es
peor que no avisar —regla 4: *un rótulo tiene que ser verdad en todos los
estados*—, así que la frase se arma con las razones que de verdad se cumplen
(`motivosLectura`), y hay un test que comprueba que en el caso de lectura corta
**no** dice «pasaría de lo que facturó».

### Prueba negativa

Se reintrodujo el defecto —quitar la revisión del paso 2, que es lo que había
antes— y el test de extremo a extremo **dio rojo**:

```
✘ una lectura con dos dígitos transpuestos: Bob la propone y se acepta
```

Restaurado, vuelve a verde. Un chequeo que nunca viste fallar es una decoración.

---

## 5. Desmarcar el lavado

`desmarcar el lavado: el 401 paga menos y el total del mes no cambia`. Las tres
cosas a la vez, que es lo que hace la prueba útil: el área común vuelve a
repartirse entre los siete, el 401 paga menos, y **el total del mes no se mueve**
—porque el lavado no es un cobro aparte: es agua que ya facturó SEDAPAL y solo
cambia de bolsillo—.

---

## 6. Publicar dos veces

El segundo intento falla limpiamente, con mensaje, sin dejar el mes a medias.

### Concurrencia

Dos escrituras simultáneas sobre el mismo mes. El bloqueo optimista es una sola
sentencia —`updateMany({ where: { mes, version } })`—, no un leer-comparar-
escribir en JavaScript. La versión anterior tenía la carrera abierta: las dos
escrituras tenían éxito y una se perdía sin ruido. Está en los 80 de integración.

---

## 7. Corregir un mes publicado

`tests/e2e/admin.spec.ts` lo hace por la pantalla, no por la API: abre la hoja
desde el panel, cambia la lectura del 202 (`35.112 → 35.500`), escribe el motivo,
guarda, y después comprueba tres cosas:

1. La cuota del 202 **cambió de verdad** en lo que sirve la API a los vecinos.
2. En **Avisos** aparece el aviso, y lleva **el monto anterior y el nuevo**, más
   el motivo tal como lo escribió el administrador.
3. En integración: queda el apunte en auditoría (`entidad: lectura`,
   `accion: corregir`) con el valor nuevo, y una corrección que descuadraría el
   mes **no se guarda**.

### Defecto encontrado aquí

La hoja de corrección **contaba como cambio un valor idéntico al que ya había**.
El teclado numérico abre con la lectura actual puesta; si el administrador la
confirmaba sin tocarla, el botón se desbloqueaba y decía *«Guardar la corrección
y avisar»*, y el servidor respondía con un 400 —*«No hay nada que corregir: los
valores son los mismos»*— que el administrador leería como que la app se rompió.

Arreglado en `HojaCorregir.tsx`: un valor igual al original **sale** del conjunto
de cambios, así que el botón vuelve a decir *«Cambia algo para poder corregir»*,
que es la verdad.

---

## 8. Exportar el año en Excel

El prototipo tenía la hoja dibujada y la descarga no existía. Aquí se descarga de
verdad: `/api/export/[anio]` genera el `.xlsx` con el mismo motor que la app, y
el navegador lo baja.

El test espera el evento `download`, comprueba el nombre del fichero, **abre el
libro con ExcelJS** —que lo lea ya prueba que es un `.xlsx` y no un HTML de
error— y compara las siete cuotas de junio **celda por celda** contra lo que
sirve la API.

### Defecto en mi propio chequeo

La primera versión buscaba cada cuota *«en algún sitio del libro»*. Como la hoja
de **Pagos** repite las mismas siete cifras que la de **Cuotas**, desviar la fila
de Cuotas en un céntimo **seguía dando verde**. Y una segunda versión comparaba
texto formateado (`"634.90"`) contra celdas numéricas (`634.9`), así que pasaba
solo en las cuotas que no terminan en cero.

Ahora localiza la hoja `Cuotas`, la fila de junio y la columna de cada
departamento, y compara números. Prueba negativa: se desvió la fila de cuotas en
`+0.01` y el test dio rojo nombrando la cifra:

```
Error: la cuota del 101 en la celda de junio
Expected: 373.82
Received: 373.83
```

---

## 9. Dos defectos de infraestructura de prueba, y sus chequeos

### El servidor viejo que servía el build de antes

La suite de extremo a extremo daba por hecho que había un `next start` corriendo.
Uno que llevaba media hora arriba seguía sirviendo el `.next` que un `next build`
posterior había reemplazado: **los catorce chunks de JavaScript devolvían 400**,
la página se pintaba en el servidor y no reaccionaba a nada, y el rojo salía como
*«no aparece el diálogo»* en un test que no tenía nada que ver con el problema.

Cerrado en `playwright.config.ts`: Playwright construye y levanta su propio
servidor (`webServer`, `reuseExistingServer: false`). Cuesta un minuto y quita la
clase entera de fallo.

### Dos ficheros resembrando la misma base a la vez

`test.describe.configure({ mode: 'serial' })` ordena los tests de **un** fichero,
no los de dos. Con `cierre.spec.ts` y `admin.spec.ts` en workers distintos, los
dos llamaban a resembrar contra la misma base: el cierre se quedaba a medias
porque el otro le había borrado el mes debajo, y el rojo aparecía en el fichero
inocente. En aislado los dos pasaban; juntos, no.

Cerrado con `tests/e2e/basedatos.ts`: un cerrojo entre procesos por fichero
creado con `wx` —creación exclusiva, atómica en el sistema de ficheros, sin
carrera entre comprobar y crear—. Los tests de solo lectura siguen en paralelo.
Si el cerrojo no se puede tomar en 180 s, **falla**: soltarlo a la fuerza
enmascararía la causa.

---

## 10. La mejor objeción de un escéptico competente

> *«Enseñas la propuesta de corrección en el paso 2 y el documento de diseño la
> dibuja en el paso 1. Dijiste que en copys y diseño manda el mockup. Te
> saltaste tu propia regla.»*

Es la objeción correcta y merece respuesta, no excusa. Tres cosas:

1. **El texto es literal.** Hay un test que compara la frase con la del documento
   carácter a carácter, en el caso que el documento enseña.
2. **La regla de cálculo es literal.** `proponerCorreccion` no se tocó: sigue
   pasando los 90 tests de fidelidad contra el mockup.
3. **Lo que cambió es el momento**, y es lo único que hace que la función exista.
   En el paso 1 la propuesta no aparece nunca —cero en 11.329 lecturas medidas—.
   Entre respetar el sitio del dibujo y que la función haga algo, gana que haga
   algo: `04` §"Corrección de tecleo" describe un comportamiento, y la única
   forma de tenerlo es preguntar cuando hay recibo. El paso 1 lo conserva para el
   caso en que sí puede responder.

Segunda objeción, más incómoda:

> *«El descarte de una propuesta ("No, lo dejo así") no se guarda en el servidor.
> Si el administrador vuelve al paso 2, la pregunta reaparece.»*

Cierto, y es deliberado: la lectura sospechosa **sigue siéndolo**. Callar la
pregunta para siempre porque una vez se dijo que no es esconder un dato que aún
no cuadra. Cuesta un toque; el silencio costaría una cuota mal.

---

## 11. Lo que queda declarado, no arreglado

1. **La tolerancia del cuadre del agua sigue en 0.03**, exactamente en el peor
   caso observado para datos realistas (0,029999999999972 sobre 300.000 meses
   simulados), y falla el 45,72 % de las veces en la rama de reparto ajustado.
   No se toca porque las reglas de cálculo son literales. La decisión —subirla a
   0.05, o repartir el último céntimo— es del usuario y está en cola para
   `docs/AUDITORIA-FINAL.md`.
2. **El descarte de una propuesta de corrección no persiste** entre visitas al
   paso 2. Justificado arriba.
3. **La propuesta se calla con dos departamentos sospechosos**, que es lo que
   manda `01` §8, pero **no dice que se ha callado**. El administrador no sabe que
   la app vio algo raro. Está en cola para la auditoría final: enseñar un aviso
   sin propuesta («hay más de una lectura que no cuadra») sería honesto, pero es
   texto nuevo que el mockup no tiene y no lo invento en esta fase.

---

## 12. Bajo qué condición esto estaría equivocado, y cuál sería la señal temprana

**Estaría equivocado si** los datos reales del edificio se parecen menos a los de
ejemplo de lo que supongo: el reparto de julio no entra en la rama ajustada
—`ajustado: false`, `factor: 1`—, así que el camino donde la tolerancia del
cuadre falla el 45,72 % de las veces **no lo recorre ningún test de esta fase**.
Ocho meses de ejemplo son ocho puntos del espacio, no el espacio.

**La señal temprana** sería un mes en que los medidores sumen más de lo que
facturó SEDAPAL. Ahí entra la rama ajustada, y el paso 6 bloqueará la publicación
por un descuadre de céntimos que el administrador no va a saber explicar. Si eso
pasa antes de que se decida la tolerancia, el mes se queda sin publicar.

**Segunda señal**: si la propuesta de corrección no aparece nunca durante varios
meses reales, no significa que no haya erratas — significa que hay que volver a
medir cuántas veces la regla de §8 encuentra exactamente una candidata con datos
de verdad. Lo medido es una sola cosa y conviene no estirarla: **en julio de
2026, cinco de los siete departamentos** (101, 201, 401, 501 y 502) tienen al
menos una transposición de dígitos adyacentes que la regla detecta y corrige
sola; el 301 y el 202, ninguna. Es un mes, no una tasa.

---

## 13. Lo que encontraron los verificadores adversarios, después de dar la fase por buena

Con los diez puntos en verde se soltaron tres verificadores de solo lectura, con
ángulos que se solapan poco: **los textos que ve el usuario**, **las rutas que
escriben**, y —el que más rindió— **si los propios chequeos mienten sobre lo que
cubren**. Cada hallazgo se volvió a confirmar aquí antes de tocar nada; los que
no se sostuvieron, se descartaron.

### 13.1 · Dinero que se movía solo, en meses ya publicados

| Qué | Medido | Arreglo |
|---|---|---|
| Los m³ del lavado vivían en un campo **global** y `lavadoM3En` lo leía para cualquier mes | subir 1.50 → 3.00 movía la cuota de junio del 401 en **S/ 6.25**, mes publicado y avisado | publicar **congela** el valor del mes (`ReasignacionActivaEnMes.m3`) |
| `PUT /api/meses/[mes]/gastos-fijos` no comprobaba si el mes estaba publicado | con junio publicado, un PUT sobre junio subió la cuota del 101 de **S/ 373.82 a S/ 1,355.25**, y el vecino veía la nueva | `exigirNoPublicado` en el servicio |
| **Dos calculadoras del mes**: `recalcularEnTransaccion` era una copia de `entradasDeMes` y se habían separado | el aviso de corrección citaba «el 401 pasó de X a Y» con una Y que la app no cobraba | borrada; los lectores aceptan el cliente de la transacción |
| Publicar era leer-comparar-escribir | dos publicaciones simultáneas salían las dos: dos avisos a los siete, versión 2→4 | `updateMany` condicional con `publicado: false` |
| `POST /api/pruebas/resembrar` borraba la base **sin PIN** | `curl -X POST` sin cookie → `200 {"ok":true}`, base vacía | `exigirAdmin()`, además del guardia de entorno |
| `version` era `.optional()` y `tomarVersion` no comprueba nada con `undefined` | cuatro rutas se saltaban el bloqueo entero | obligatoria en la puerta HTTP, opcional para quien llama al servicio |
| El paso 4 avisaba a los siete en **cada tanteo del numpad** | un aviso por toque, sobre un mes que para ellos no existe | el cierre no avisa; el panel sí |
| `guardarPaso` escribía sin auditar | contra la regla «toda escritura deja rastro», declarada no negociable | audita el cambio de paso |

Y uno mío, encontrado al comprobar el arreglo del primero: la **migración**
insertaba `activa = TRUE` a ciegas para los meses publicados, así que encendía el
lavado en un mes que lo tenía apagado por herencia. Se replicó la migración sobre
una base aparte con ese caso montado a mano: con la versión vieja, junio pasaba
de apagado a `t / 1.50`; con la corregida, se queda apagado.

### 13.2 · Chequeos que no comprobaban lo que decían

Este es el ángulo que más rindió, y el más incómodo, porque los chequeos eran
míos y estaban en verde.

1. **El test de «con dos sospechosos me callo» era una tautología** —
   `if (p !== null) expect(p.dpto).toBe('401') else expect(p).toBe(null)`— y
   encima su escena no producía **ningún** sospechoso. Cambiar
   `encontradas.length === 1` por `>= 1` dejaba los tres tests que la nombran
   igual de verdes. Se buscó por fuerza bruta una escena que sí produce dos
   (46.769 combinaciones), y resultó enseñar por qué la regla importa: **uno de
   los dos señalados está bien tecleado**. Con dos lecturas malas, la suma de los
   otros medidores se descoloca para todos y la regla acusa a un inocente.
2. **La lista blanca de `verificar-tokens` eximía la línea entera** de las siete
   reglas. De diez defectos plantados atrapaba uno: un `className="bg-red-500"`
   con un `#ff0000` al lado pasaba limpio si compartía línea con un `viewBox`. Y
   **33 líneas reales del repo** estaban fuera de todo. Ahora cada excepción
   nombra la regla que perdona, y el meta-test planta los defectos **en la misma
   línea** que el patrón perdonado.
3. **`scripts/` se recorría, se contaba en el resumen y ninguna regla se le
   aplicaba**: los ocho ficheros son `.mjs` y `aplicaA` solo listaba `.ts`,
   `.tsx` y `.css`. El resumen decía `scripts:8` como si los hubiera mirado.
4. **El chequeo salía en verde habiendo revisado un archivo**: un árbol con solo
   `app/globals.css` daba `✓ cero valores huérfanos · 1 archivos`, salida 0. Un
   `--raiz` equivocado pasaba por verde. Ahora hay un piso por carpeta y los
   fixtures declaran su alcance con `--espera N`.
5. **Los 14 tests de responsive de «Administración» medían la pantalla del PIN.**
   La sesión de admin no viaja en el `storageState`, así que el servidor devolvía
   `<PedirPin/>` y el chequeo medía un teclado de cuatro dígitos. El panel y sus
   cuatro hojas —las pantallas más densas de la app— **no tenían ni una medida de
   desborde**. Ahora cada pantalla lleva un centinela: si lo que se mide no es lo
   que se dice medir, el test falla.
6. **`baseURL` y el puerto del servidor eran independientes**: con `BASE_URL`
   puesta, Playwright construía en el 3200 —un minuto— y visitaba otro sitio, en
   verde. El comentario que decía haber cerrado esa clase de fallo mentía.
7. **El cerrojo de la base se quedaba puesto** si el proceso moría, y a partir de
   ahí todas las corridas fallaban con un mensaje que no decía por qué; su propio
   mensaje de diagnóstico era código muerto, porque esperaba 180 s con un límite
   de test de 30. Ahora lleva PID, se recoge si está huérfano, y lo comparte la
   suite de integración.
8. **Cuatro tests decían probar un CHECK y solo probaban que algo saltó.**
   `rejects.toThrow()` pasa igual con un «record not found». Ahora se exige el
   nombre de la restricción.
9. **`mode: 'serial'` escondía huecos**: una corrida dio `93 passed / 1 failed /
   2 did not run`, y los dos saltados incluían la única cobertura de la
   reasignación de agua. Se quitó: un worker, en orden, y nadie arrastra a nadie.
10. **Los scripts de prueba negativa** dejaban el defecto puesto si los
    interrumpían.
11. **La rama de propuesta del paso 1 no la ejercía nadie**, y tenía un
    comportamiento propio: enseñaba la propuesta y **no guardaba** lo tecleado
    hasta que el administrador pulsara un botón. Cerrar la hoja ahí perdía la
    lectura, en el paso cuya promesa es que se guarda solo. Ahora se guarda
    primero y se pregunta después.

### 13.3 · Textos

- Bob, en el paso 2, repetía el número recién tecleado —que no dice nada que la
  cifra de al lado no diga— y metía el identificador crudo en la frase: *«el
  recibo de 2026-07»*. `04` pide que **compare**; ahora compara con los dos meses
  anteriores, y si no hay ninguno lo dice en vez de inventar la comparación.
- La propuesta de corrección decía *«el consumo sería -82.60 m³»* cuando el
  medidor retrocede. Un consumo negativo no es un dato: es el síntoma de que la
  resta se hizo al revés.
- Contaba dos problemas distintos con las mismas cuatro palabras: *«muy por
  debajo de tu promedio, y … muy por debajo de lo que facturó SEDAPAL»*.
- `Math.round` en el múltiplo del promedio anunciaba 2.4 veces como *«el doble»*.
  El redondeo se queda —`04` llama «cuatro veces» a 3.67 y el copy es literal—;
  lo que cambia es el texto: *«más del doble»*, cierto por construcción.
- El aviso de corrección encadenaba *«la lectura del 202 y la lectura del 301 y
  la lectura del 401»*. Con dos se leía bien, por eso pasó desapercibido.
- **Dos hojas del panel se quedaban en «Cargando…» para siempre** al fallar la
  consulta: en TanStack Query v5, agotado el reintento, `isLoading` vuelve a
  `false` y `data` sigue `undefined`, así que `isLoading || !data` caía siempre
  en la rama de carga. *Cargando*, *error* y *vacío* son tres cosas distintas.
- **El Excel prometía lo que no llevaba**: *«las lecturas de medidor»* sin ni una
  lectura, y *«las 7 cuotas con su desglose»* sobre una pestaña de totales. Se
  arregló el archivo, no el texto: es lo que alguien abre para recalcular a mano.
- **Ofrecía descargar 2025**, que es un solo mes que no se publica nunca y existe
  para darle a enero su lectura anterior; e incluía el mes en curso sin decirlo.
  Ahora solo años con meses publicados, y bajo cada botón la línea que el
  prototipo tenía y se cayó al portar: *«6 meses de 2026, de enero a junio.»*
- **«Corregir un mes publicado» solo corregía el último.** El artículo indefinido
  promete escoger y el botón no dejaba: mayo —el mes del ejemplo de `04`— era
  inalcanzable. Ahora la hoja lista los meses publicados y se elige.

### 13.4 · Lo que los verificadores señalaron y no se sostuvo

- Que el bloqueo optimista no fuera atómico: lo es. El problema era **quién no lo
  llamaba**, no cómo estaba escrito.
- Que `/api/export/[anio]` sin PIN fuera una fuga: no lleva nada que no esté ya
  en `/api/meses`, que es pública por diseño.
- Que hubiera escrituras fuera de transacción: no se encontró ninguna. El dato y
  su apunte de auditoría van siempre dentro del mismo `$transaction`.
- Que la frase de la propuesta no fuera literal: lo es, carácter a carácter, y el
  test que lo dice existe y es cierto.

### 13.5 · La lección, que no es «faltaban tests»

De los once defectos de §13.2, **nueve estaban en chequeos que ya existían y
estaban en verde**. Ninguno se habría encontrado escribiendo más tests: se
encontraron rompiendo el código a propósito y mirando si el chequeo se enteraba.

La prueba negativa no es una ceremonia. Es el único momento en que un chequeo
demuestra que sirve.
