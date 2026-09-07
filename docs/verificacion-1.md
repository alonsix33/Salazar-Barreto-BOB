# Verificación 1 · Motor de cálculo

Estado al cerrar la fase: **verde, con dos limitaciones declaradas** (§6).

```
npx tsc --noEmit                 sin errores
npx vitest run                   245 tests en verde
node scripts/verificar-tokens.mjs cero valores huérfanos
node scripts/prueba-negativa.mjs  12 de 12 defectos detectados
```

---

## 1. Comparación numérica contra el mockup

El prototipo se abrió **en un navegador de verdad** (Chromium, 440×1600) con
`scripts/comparar-con-mockup.mjs`, que hace tres cosas:

1. sirve desde copias locales del registro de npm los tres scripts que el runtime
   del prototipo pide a `unpkg`, porque la red de este entorno los bloquea;
2. **lee de la pantalla renderizada** las siete cuotas de junio, el total, los m³
   de SEDAPAL, la factura y el área común;
3. ejecuta `window.__EDIF__.calcularMes()` dentro de esa misma página para junio
   y julio.

### Junio y julio, motor del mockup ↔ motor de producción

| Dato | Mockup | Motor | |
|---|---:|---:|:-:|
| 2026-06 · total del mes | 3,317.98 | 3,317.98 | ✅ |
| 2026-06 · factura de agua | 325.00 | 325.00 | ✅ |
| 2026-06 · área común (m³) | 1.62 | 1.62 | ✅ |
| 2026-06 · área común (S/) | 6.75 | 6.75 | ✅ |
| 2026-06 · suma de medidores | 74.88 | 74.88 | ✅ |
| 2026-06 · lavado (m³) | 1.50 | 1.50 | ✅ |
| 2026-06 · cuota 101 | 373.82 | 373.82 | ✅ |
| 2026-06 · cuota 201 | 342.79 | 342.79 | ✅ |
| 2026-06 · cuota 202 | 634.90 | 634.90 | ✅ |
| 2026-06 · cuota 301 | 371.71 | 371.71 | ✅ |
| 2026-06 · cuota 401 | 384.33 | 384.33 | ✅ |
| 2026-06 · cuota 501 | 528.25 | 528.25 | ✅ |
| 2026-06 · cuota 502 | 675.43 | 675.43 | ✅ |
| 2026-07 · total del mes | 3,374.38 | 3,374.38 | ✅ |
| 2026-07 · factura de agua | 338.60 | 338.60 | ✅ |
| 2026-07 · área común (m³) | 1.62 | 1.62 | ✅ |
| 2026-07 · área común (S/) | 6.77 | 6.77 | ✅ |
| 2026-07 · suma de medidores | 77.88 | 77.88 | ✅ |
| 2026-07 · lavado (m³) | 1.50 | 1.50 | ✅ |
| 2026-07 · cuota 101 | 381.83 | 381.83 | ✅ |
| 2026-07 · cuota 201 | 342.85 | 342.85 | ✅ |
| 2026-07 · cuota 202 | 683.54 | 683.54 | ✅ |
| 2026-07 · cuota 301 | 371.02 | 371.02 | ✅ |
| 2026-07 · cuota 401 | 388.96 | 388.96 | ✅ |
| 2026-07 · cuota 501 | 535.69 | 535.69 | ✅ |
| 2026-07 · cuota 502 | 663.70 | 663.70 | ✅ |

### Junio, leído de la pantalla renderizada

Esto comprueba lo otro: que la interfaz **pinta lo que el motor calcula**, con su
formato incluido.

| Dpto | Pantalla mant. | Motor mant. | Pantalla agua | Motor agua | Pantalla total | Motor total | |
|---|---:|---:|---:|---:|---:|---:|:-:|
| 101 | 350.78 | 350.78 | 23.04 | 23.04 | 373.82 | 373.82 | ✅ |
| 201 | 305.58 | 305.58 | 37.21 | 37.21 | 342.79 | 342.79 | ✅ |
| 202 | 602.19 | 602.19 | 32.71 | 32.71 | 634.90 | 634.90 | ✅ |
| 301 | 305.58 | 305.58 | 66.13 | 66.13 | 371.71 | 371.71 | ✅ |
| 401 | 305.58 | 305.58 | 78.75 | 78.75 | 384.33 | 384.33 | ✅ |
| 501 | 518.08 | 518.08 | 10.17 | 10.17 | 528.25 | 528.25 | ✅ |
| 502 | 605.18 | 605.18 | 70.25 | 70.25 | 675.43 | 675.43 | ✅ |

| Otros | Pantalla | Motor | |
|---|---:|---:|:-:|
| total del mes | 3,317.98 | 3,317.98 | ✅ |
| m³ de SEDAPAL | 78 | 78 | ✅ |
| factura de agua | 325.00 | 325.00 | ✅ |
| área común | 1.62 m³ | 1.62 m³ | ✅ |
| saldo de junio | 4,182.40 | 4,182.40 | ✅ |

### Los ocho meses, campo por campo

Además de junio y julio, `lib/calculo/__tests__/fidelidad-mockup.test.ts` compara
los **ocho meses** de la semilla contra un fichero de referencia generado
ejecutando `mockup/.../datos-edificio.js` (`scripts/generar-golden.mjs`). Compara
18 agregados, los siete consumos, las diez líneas de gasto y los nueve campos de
cada una de las siete cuotas, además de las seis variantes con overrides y la
serie del saldo. **Todo coincide al céntimo.**

El generador **no importa nada de `lib/`**: si lo hiciera, la comparación sería
el motor contra sí mismo. Se comprobó regenerándolo: el JSON sale byte a byte
idéntico al del repositorio, así que tampoco está editado a mano.

### Una diferencia de formato, declarada

`01` §9 especifica `toLocaleString('es-PE', {min:2, max:2})` e ilustra el
resultado como `1 234.56`, con espacio. El ICU actual —el del navegador y el de
Node— devuelve `1,234.56`, con coma. Se comprobó **ejecutando los dos**:

```
mockup en Chromium   fmt(1625) = "1,625.00"
motor en Node        fmt(1625) = "1,625.00"
```

Manda la llamada, que es lo que el prototipo ejecuta y lo que el cliente vio en
pantalla. El `1 234.56` del documento es una ilustración escrita a mano.

---

## 2. ¿Se movió algún redondeo de sitio?

No. Se contaron y compararon uno a uno:

| | `calcularMes` |
|---|---|
| `Math.round` en el original | 16 |
| `round2` + `Math.round` en el port | 16 |

Y en el mismo orden, sobre las mismas expresiones: consumo por departamento,
`sumaMedida`, `facturaAgua`, `brutoComun`, `comunReal`, `m3` cobrados, `montoAgua`,
`montoComun`, `totalMes`, `baseMant`, `mant`, `mantenimiento`, `total` de cada
cuota, `sumaAgua`, `totalCreditos`, `sumaCuotas`.

**Corrección de un comentario que mentía.** El port llevaba escrito que
`Math.round(baseMant * flat) / 100` es "exactamente" `round2(baseMant * flat / 100)`.
Es falso, y se comprobó ejecutando:

| baseMant | flat | forma del original | forma "simplificada" |
|---:|---:|---:|---:|
| 2 925.00 | 20.22 | **591.44** | 591.43 |
| 2 312.50 | 11.72 | **271.03** | 271.02 |
| 2 862.50 | 20.12 | **575.94** | 575.93 |

El código estaba bien —conserva la forma del original, que es lo que `01` §9
exige—; el comentario invitaba a "simplificarlo" y mover un céntimo de verdad.
Comentario corregido y **caso fijado en un test** (`produccion.test.ts`).

`parseFloat`, `parseInt` y concatenación de cadenas sobre montos: **cero** en
`lib/calculo/`. La única cadena que se manipula está en `proponerCorreccion`, y es
la reconstrucción del número desde sus dígitos, que es lo que hace el original.

---

## 3. `any`, `@ts-ignore`, `@ts-expect-error`

**Cero** en `lib/calculo/`. Comprobado con grep. Las aserciones `as` que quedan
—todas sobre `Object.fromEntries` recorriendo `DPTOS`, sobre `ORDEN_GASTOS` como
tupla literal, y sobre el `split` de un `MesId` ya validado— **llevan cada una su
comentario justificando por qué**, como pide el prompt.

---

## 4. Lo que encontraron los verificadores adversarios

Se lanzaron tres en paralelo, de solo lectura, con ángulos distintos: fidelidad
del port contra el original, defectos de ejecución con entradas raras, y
**si los propios tests mienten sobre lo que cubren**. Encontraron 12, 12 y 12
hallazgos. Estos son los que resultaron ciertos al comprobarlos y lo que se hizo.

Los dos primeros coinciden en el diagnóstico de fondo, y es el hallazgo más
importante de la fase:

> **Los dos cuadres de `01` §5 son identidades algebraicas.** Comprueban que las
> partes suman el todo, y eso lo cumplen igual de bien unas cifras absurdas.

### CRÍTICO · Faltaba una lectura del mes y el mes cuadraba igual

Si a un mes le faltaba la lectura de un departamento, el motor arrastraba la del
mes anterior. Consumo 0, agua S/ 0.00, y esos m³ se iban al área común, que la
pagan los siete desde el saldo. **Los dos cuadres daban verdadero**, porque se
comparan contra su propia `sumaMedida` y no pueden ver una lectura que no está.
El paso 6 del cierre habría dejado publicar.

Medido en junio, quitando la lectura del 502:

| | completo | sin la lectura del 502 |
|---|---:|---:|
| agua del 502 | 70.25 | **0.00** |
| área común | 6.75 | **77.00** |
| `cuadra` | true | **true** |

**Arreglado:** faltar una lectura del mes deja el resultado marcado como inválido,
con la lista de departamentos que faltan en `dptosSinLectura`, igual que ya pasaba
con las del mes anterior. **Test añadido y prueba negativa hecha.**

### CRÍTICO · El total se tragaba un gasto tecleado como cadena

`gastos.reduce((s, g) => s + (g.monto || 0), 0)`: con `monto` en `"1200"`,
`3317.98 + "1200"` **concatena** y da `"3317.981200"`, que `round2` trunca de
vuelta a `3317.98`. El gasto salía pintado en la lista por S/ 1 200.00, no entraba
en el total, y el mes cuadraba. La cuenta se drena y nadie se entera.

**Arreglado:** la suma vive en `sumarMontos()`, exportada y probada sola, y solo
suma números finitos. Lo que no lo sea lo detecta además el tercer cuadre.

### CRÍTICO · Un medidor reemplazado producía una cuota negativa publicable

Sin comprobación de `consumo >= 0`, un medidor cambiado daba consumo −174.20 m³,
agua −S/ 725.83 y una cuota de **S/ −375.05**, con los dos cuadres en verde: el
área común absorbía el error y la identidad se mantenía.

### ALTO · Un descuento mayor que el monto daba un precio del m³ negativo, y cuadraba

`aguaMonto 100` con `descuento 350` daba `facturaAgua −250`, `precioM3 −3.21` y
cuotas negativas. Los dos cuadres, en verde.

**Arreglado (los dos):** se añadió `lib/calculo/sanidad.ts`, **el tercer cuadre**.
No cambia ningún cálculo: comprueba que ninguna cifra sea imposible por
construcción —consumo negativo, precio o factura negativos, área común negativa,
factor de ajuste mayor que 1, cualquier `NaN` o `Infinity`, un crédito a un
departamento que no existe, y que el total coincida con la suma explícita de sus
líneas—. `cuadra` ahora es `cuadraAgua && cuadraMes && cuadraSanidad`, así que el
paso 6 del cierre bloquea. Los motivos van redactados para el vecino, no para el
programador: *"El medidor del 101 marca menos que el mes pasado. Si lo cambiaron,
hay que anotar la lectura de arranque."*

### ALTO · Cinco caminos de producción sin un solo test

El auditor de chequeos lo demostró de la peor manera posible: **el motor cambió a
mitad de auditoría y los 140 tests dieron verde antes y después.** Una suite que
no distingue dos motores con comportamiento distinto en dinero no bloquea nada.

Sin cobertura estaban: los extras **guardados** (todos los tests entraban por el
borrador), `ov.lecturas` —el override que el motor consume mientras el
administrador teclea el cierre—, `ov.recibo.descuento` del borrador, la guarda de
lecturas faltantes recién puesta, y la forma escrita del redondeo del
mantenimiento.

**Arreglado:** `lib/calculo/__tests__/produccion.test.ts`, 45 tests nuevos sobre
esas rutas, y `scripts/prueba-negativa.mjs`, que inyecta doce defectos reales uno
por uno y comprueba que la suite se pone roja. **Los doce se detectan.**

### ALTO · `undefined` en un override borraba un gasto

`ov.fijos = { Ascensor: undefined }` se trataba como "por confirmar" y quitaba
S/ 680 del total, cuadrando igual. `undefined` significa "no lo estoy tocando";
`null` significa "por confirmar". **Arreglado y con test.**

### ALTO · Un `lavadoM3` nulo desde la base desactivaba el lavado en silencio

Movía S/ 6.25 del 401 al bolsillo común sin avisar. Ahora un `null` cae al valor
configurado; solo un 0 explícito lo desactiva, que es lo que hace la casilla del
paso 5. **Arreglado y con test.**

### ALTO · La lista de gastos se inventaba líneas

Con la tabla de gastos fijos vacía salían diez líneas "por confirmar" sumando 0,
un total de S/ 643.40 en vez de S/ 3 317.98, y `cuadraMes` en `true`. Ahora la
lista sale de los conceptos que existen: con la tabla vacía el mes tiene dos
líneas y **el problema se ve**. De paso, un concepto nuevo escrito en el borrador
ya entra en el mes, cosa que antes se descartaba en silencio.

### ALTO · `aguaM3 = Infinity` atravesaba el guardián

`Infinity > 0` es verdadero, así que pasaba y dejaba `montoComun` en `NaN` dentro
de un resultado marcado como **válido**, mientras `tipos.ts` prometía por escrito
"nunca un `NaN`". Ahora el guardián exige `Number.isFinite`. **Con test.**

### MEDIO · Un `mesId` mal formado producía texto basura en pantalla

`mesAnterior('junio')` devolvía `'NaN-NaN'`; `mesCorto('2026-13')` devolvía
`undefined` con el tipo declarado `string`; `etiquetaMes('')` pintaba
`"undefined 0"`. `esMesId` existía y **no la llamaba nadie**. Ahora las cinco
funciones la exigen y lanzan un error claro, y `calcularMes` devuelve un mes
inválido en vez de calcular sobre basura.

### MEDIO · Un `null` no podía borrar un descuento guardado

`01` §11 dice que cada campo del override pisa la semilla individualmente. Con
`??` encadenado, `null` se comportaba igual que "no lo estoy tocando", así que un
mes sin descuento heredaba los S/ 17.33 del guardado: dinero que el edificio
dejaba de cobrar, con los dos cuadres en verde. **Arreglado y con test.**

### MEDIO · `proponerCorreccion` con un número, no con una cadena

`String(438.03)` da `"438.03"`; al quitar el punto quedan cinco dígitos y el
algoritmo lo reconstruye como `43.803`, diez veces menos. **Una de cada diez
lecturas reales termina en 0** (`174.700` → `"174.7"`) y llegaba deformada, con lo
que la corrección quedaba muerta sin que nada avisara. Ahora un número se
normaliza a tres decimales, que es como viene del medidor.

### MEDIO · Un crédito a un departamento inexistente se evaporaba

No se le restaba a nadie, no entraba en `totalCreditos`, y el mes cuadraba. El
vecino nunca veía su devolución. Ahora el mes sale inválido diciendo qué
departamento no existe.

### MEDIO · Entradas nulas de la base lanzaban `TypeError`

Seis formas distintas (`fijos`, `extras`, `lecturas`, `lecturasAnteriores`, las
entradas enteras, el override entero) reventaban en medio del cierre del mes.
Ahora se normalizan y devuelven un resultado. La validación de verdad va con Zod
en el borde de la API (Fase 3); esto es defensa en profundidad.

### MEDIO · `-0` llegaba a pantalla como `S/ -0.00`

`Math.round(-0.004)` devuelve `-0`. Normalizado en `round2`/`round3`. No cambia
ninguna comparación —`-0 < 0` ya era `false`— y quita un menos que no significa
nada. `fmt` además convierte cualquier valor no finito en `—`.

### MEDIO · Dos cifras de un comentario no se podían reproducir

El comentario de la limitación del cuadre afirmaba "peor error 0.03" para el
reparto normal y "26.4 %, peor 0.16" para el ajustado. Ninguna de las dos salía
del generador que el archivo contiene: eran de una corrida distinta. Es
exactamente el rótulo que miente contra el que existe este método.

**Arreglado:** las cifras salen ahora de `scripts/medir-tolerancia.mjs`, con los
dos generadores a la vista y reproducible. Ver §6.

### Lo que se miró y estaba bien

Vale la pena dejarlo escrito para que nadie lo vuelva a mirar:

- El fixture **no** se compara consigo mismo; el generador solo importa `node:fs`
  y `node:path`.
- Los 25 `assert()` de `01` §10 están uno a uno, ninguno suavizado: cero
  `toBeCloseTo` donde el documento dice `===`.
- La puerta de atrás `if (!c.valido) return true` de las propiedades no se traga
  nada: 200 de 200 corridas llegan a las aserciones.
- Cero `it` vacíos, cero `expect(true)`, cero `skip`.
- 4 467 casos diferenciales contra el original (`calcularMes`), 200 000 de
  `proponerCorreccion` y la serie de saldo entera: **0 divergencias numéricas**.
- `factor > 1` no ocurre nunca en 41 746 combinaciones; la división
  `aguaM3 / sumaMedida` es inalcanzable con `sumaMedida = 0`.
- La reasignación del lavado conserva la suma de m³ exactamente.

---

## 5. Prueba negativa

Un chequeo que nunca se vio fallar es una decoración. `scripts/prueba-negativa.mjs`
inyecta doce defectos reales, uno por uno, y comprueba que la suite se pone roja:

```
✓ rojo (  1 tests)  no exigir las siete lecturas del mes
✓ rojo (  2 tests)  ignorar los extras guardados y mirar solo el borrador
✓ rojo (  2 tests)  ignorar las lecturas que se están tecleando
✓ rojo (  4 tests)  ignorar el descuento del borrador
✓ rojo (  1 tests)  simplificar el redondeo del mantenimiento a round2
✓ rojo ( 68 tests)  redondear el precio del m³
✓ rojo ( 16 tests)  sumar el lavado en vez de reasignarlo
✓ rojo (  2 tests)  sacar el tercer cuadre de la condición de publicar
✓ rojo (  2 tests)  dejar que un lavadoM3 nulo desactive el lavado
✓ rojo (  2 tests)  volver al `|| 0` que concatena cadenas al sumar los gastos
✓ rojo (  1 tests)  tratar un override undefined como "por confirmar"
✓ rojo (  3 tests)  aflojar la tolerancia del cuadre del agua cien veces

Restaurado: la suite vuelve a estar en verde.
✓ los 12 defectos se detectan.
```

El script también falla si el código que dice sustituir ya no existe, para que no
se quede mintiendo sobre su alcance cuando el motor cambie.

---

## 6. Las dos limitaciones que quedan, declaradas

### 6.1 La tolerancia del cuadre del agua no tiene margen

`Σ agua(d) + montoComun` acumula **ocho redondeos a céntimo** —siete cuotas más el
área común—, así que el error puede llegar a `8 × 0.005 = 0.04`. La tolerancia de
`01` §5.1 es **0.03**. La cota está por encima de la tolerancia.

Medido con `npx tsx scripts/medir-tolerancia.mjs 300000`, con los dos generadores
a la vista en el script:

| Rama | Meses | `cuadraAgua` falla | `cuadraMes` falla | Peor error |
|---|---:|---:|---:|---:|
| Normal (SEDAPAL ≥ medidores, 3.80–4.60 S//m³) | 300 000 | **0** (0.0000 %) | 0 | **0.029999999999972** |
| Ajustado (SEDAPAL < medidores) | 300 000 | **137 146** (45.72 %) | 56 190 (18.73 %) | **0.11** |

Dos lecturas de esa tabla:

1. **Con datos como los del edificio el cuadre nunca falla**, pero el peor caso
   observado se queda a 3 × 10⁻¹⁴ de la tolerancia. No hay margen. Basta un
   recibo con un precio del m³ fuera de lo normal para que salte.
2. **En reparto ajustado falla casi la mitad de las veces.** Cuando los medidores
   miden de más —que es ocasional pero pasa—, el paso 6 bloquearía la publicación
   por una diferencia de céntimos que es puro redondeo, y el administrador no
   tendría cómo arreglarlo.

**No se ha tocado.** Las reglas de cálculo son literales: donde el mockup y la
calidad de producción parecen contradecirse, en cálculo manda el mockup. La
limitación queda fijada en dos tests con casos reproducibles, y los márgenes reales
de los ocho meses de la semilla (`[0.01, 0, 0.01, 0.02, 0.01, 0.01, 0]`) están
fijados en otro, para que mover un redondeo se note.

**Lo que hace falta decidir contigo** está en `docs/AUDITORIA-FINAL.md`: subir la
tolerancia del agua a 0.05 como la del mes, o repartir el último céntimo en la
cuota mayor. Las dos son de una línea. Ninguna se hace sin tu visto bueno.

### 6.2 `proponerCorreccion` sí propone con una lectura menor que la anterior

El prompt pide un test: *"con una lectura menor que la anterior, `null`"*. El motor
original **no** se comporta así, y se comprobó ejecutándolo:

| Tecleado | Anterior | Devuelve |
|---|---:|---|
| `483.038` (dígitos transpuestos) | 420.638 | `{ valor: 438.038 }` |
| `100.000` (muy por debajo) | 420.638 | `null` |
| `400.000` (por debajo, con arreglo de un dígito) | 420.638 | **`{ valor: 440.000 }`** |

`01` §8 dice *"la lectura debe ser mayor que la anterior"* como filtro sobre las
**candidatas**, no sobre lo tecleado. Y es el comportamiento correcto de producto:
escribir 400.000 en vez de 440.000 es exactamente el error que esta función existe
para atrapar. Se conserva el comportamiento del original, con los tres casos
fijados en tests, y se declara aquí la divergencia con la letra del prompt.

---

## 7. Bajo qué condición esto estaría equivocado

- **Si `datos-edificio.js` no fuera el motor validado contra recibos reales.** La
  señal temprana serían los 25 `assert()` de `01` §10, que están escritos a mano en
  el documento y no generados desde el archivo: si el archivo se hubiera
  desviado, alguno fallaría. Los 25 pasan.
- **Si la capa de datos llamara a `calcularMes` sin validar.** Los guardianes que
  se añadieron son defensa en profundidad; la validación de verdad va con Zod en
  el borde de la API, en la Fase 3. La señal temprana es un mes que sale
  `valido: false` con un motivo de tipo "no es un número": eso significa que algo
  se coló sin validar.
- **Si alguien "arregla" la limitación 6.1** tocando los dos tests que la fijan.
  Por eso está también el test de los márgenes de los ocho meses: aflojar la
  tolerancia lo enciende.
