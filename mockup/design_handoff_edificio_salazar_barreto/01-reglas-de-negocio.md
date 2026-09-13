# 01 · Reglas de negocio y motor de cálculo

> **Este es el documento más importante del paquete.** Todo lo demás es interfaz.
> Aquí está lo que puede hacer que alguien pague de más.
>
> El código de referencia está en `datos-edificio.js`, función `calcularMes()`.
> Pórtalo con fidelidad literal, incluyendo el orden de los redondeos.

---

## 1. Los siete departamentos

Cada departamento tiene un **porcentaje de participación** ("flat") fijado en la
escritura del edificio. Suma exactamente 100.00.

| Dpto | Ocupantes | Flat % | Piso |
|---|---|---|---|
| 101 | Irallys y Aaron | 11.72 | 1 |
| 201 | Carlos Mori | 10.21 | 2 |
| 202 | Renzo | 20.12 | 2 |
| 301 | Deborah y Oscar | 10.21 | 3 |
| 401 | Alonso y Julisa | 10.21 | 4 |
| 501 | Inmobiliaria | 17.31 | 5 |
| 502 | Yara y Gianpierre | 20.22 | 5 |

El flat **no** aplica al agua. El agua se cobra por consumo medido.

---

## 2. La cuota de un departamento

```
cuota = mantenimiento + agua − créditos
```

Dos mecanismos completamente distintos que se suman al final.

### 2.1 Mantenimiento — por porcentaje

```
baseMantenimiento = totalGastosDelMes − facturaDeAgua
mantenimiento(d)  = round2( baseMantenimiento × flat(d) / 100 )
```

La factura de agua se saca de la base porque el agua no se reparte por flat: se
reparte por consumo. Si no se restara, el agua se cobraría dos veces.

### 2.2 Agua — por consumo medido

```
facturaAgua = round2( montoRecibo − descuento )
precioM3    = facturaAgua / m3FacturadosPorSedapal
agua(d)     = round2( m3Cobrados(d) × precioM3 )
```

`precioM3` **no se redondea** — se usa a precisión completa y solo se redondea el
monto final de cada departamento. Redondear el precio unitario descuadra el total.

---

## 3. El agua en detalle · la parte delicada

### 3.1 Consumo medido

Cada departamento tiene medidor. El consumo del mes es la diferencia de lecturas:

```
consumo(d) = round2( lecturaActual(d) − lecturaAnterior(d) )
sumaMedida = round2( Σ consumo(d) )
```

Las lecturas se guardan con **3 decimales** (así vienen del medidor) y se muestran
con 3 decimales. Los consumos derivados se redondean a 2.

### 3.2 El área común

SEDAPAL factura el medidor matriz del edificio. Siempre factura **más** que la suma
de los medidores individuales: la diferencia es el caño común, riego, limpieza,
pérdidas.

```
brutoComun = round2( m3Sedapal − sumaMedida )
```

El área común **la pagan los siete, cada uno por su flat**: entra en la base de
mantenimiento junto con los demás gastos del mes. Lo que sale de esa base es solo
el agua que se cobra por medidor —el consumo de cada uno más el lavado del 401—,
porque esa no se reparte por porcentaje sino por lo que marcó el contador.

> Esta regla decía antes lo contrario: que el área común no se le cobraba a nadie
> y la absorbía el fondo de la cuenta. Era una invención del prototipo, no lo que
> hace el edificio, y además dejaba sin sentido §3.3: si el fondo paga el común,
> da igual cuánta agua gaste el 401 lavando el carro. Se corrigió contra la
> planilla real de la administración, donde el área común es una línea del
> mantenimiento que se reparte por porcentaje.

### 3.3 El lavado de vehículo del 401 · reasignación, no cargo extra

El 401 lava su auto una vez por semana con la manguera del **caño común**. Esa agua
ya viene dentro de lo que factura SEDAPAL.

**La regla, que costó varias iteraciones acordar:** el lavado **se reasigna**, no se
suma. Se restan los m³ del área común y se le suman al 401. El total del edificio no
cambia ni un sol.

```
lavado     = 1.5 m³/mes   (configurable desde el panel de administración)
comunReal  = round2( brutoComun − lavado )
m3Cobrados(401) = consumo(401) + lavado
m3Cobrados(otros) = consumo(otros)
```

> **Por qué importa:** la primera versión sumaba el lavado como cargo aparte. Eso
> hacía que los siete pagaran, entre todos, más de lo que SEDAPAL cobró. El dinero
> sobrante no tenía dueño. La reasignación mantiene el cuadre exacto.

**Condiciones para aplicar el lavado** (todas deben cumplirse):
- `lavadoM3 > 0` — el administrador no lo desactivó este mes
- `brutoComun >= lavadoM3` — hay suficiente área común de donde sacarlo
- `mesId >= '2026-05'` — la fecha desde la que aplica
- **no** estamos en reparto ajustado (ver 3.4)

Si alguna falla, `lavado = 0` y todo el `brutoComun` va al área común. La app lo
dice explícitamente en pantalla.

### 3.4 Reparto ajustado · cuando los medidores miden de más

Ocasionalmente la suma de los medidores individuales **supera** lo que facturó
SEDAPAL. Pasa por desfases en las fechas de lectura, no por fraude.

No se puede cobrar más agua de la que llegó en el recibo. Cuando ocurre:

```
ajustado = brutoComun < 0
factor   = m3Sedapal / sumaMedida          // < 1
m3Cobrados(d) = round2( consumo(d) × factor )
montoComun = 0                              // no hay área común que repartir
lavado = 0                                  // tampoco hay de dónde sacarlo
```

A todos se les descuenta **la misma proporción**. Nadie sale beneficiado.

**En la interfaz esto nunca se llama "ajustado" ni "Ruta A/B".** Se dice:

> "Los medidores sumaron 82.40 m³ y SEDAPAL facturó 81. Como no se puede cobrar más
> de lo que llegó en el recibo, a cada uno se le descontó la misma proporción."

---

## 4. Los gastos del mes

Diez conceptos. Los cuatro marcados como **anuales** son servicios contratados por
año que se prorratean: el monto que aparece ya es la doceava parte.

| Concepto | Monto por defecto | Anual | Notas |
|---|---|---|---|
| Guardianía · Jorge | 1 625.00 | | Fijo |
| Ascensor | 680.00 | | Fijo |
| Factura de agua SEDAPAL | *variable* | | Del recibo, menos descuento |
| Recibo de luz común | *variable* | | Del recibo |
| Mant. bomba | 208.33 | ✓ | 2 500 / 12 |
| Mant. cisterna | 50.00 | ✓ | 600 / 12 |
| Cerco eléctrico | 48.75 | ✓ | 585 / 12 |
| Cambio extintor | 32.50 | ✓ | 390 / 12 |
| Insumos limpieza | 30.00 | | Fijo |
| Pozo a tierra | `null` | | **Sin cifra confirmada.** Ver 4.1 |

Los montos fijos son **editables desde el panel de administración** y el cambio
aplica a los meses siguientes.

```
totalMes = round2( Σ montos, tratando null como 0 )
```

### 4.1 El pozo a tierra

Es un gasto real cuya cifra nadie confirmó todavía. **No se inventa un número ni se
oculta la línea.** Aparece en la lista con la etiqueta `POR CONFIRMAR`, un fondo
ámbar suave, y suma 0 al total.

Cuando el administrador le pone cifra, entra en el cálculo del mes en curso. La app
no intenta recalcular meses pasados.

### 4.2 Gastos extraordinarios y créditos

El administrador puede añadir, en el paso 5 del cierre:

- **Gasto extraordinario** — se suma a `totalMes` y por lo tanto se reparte entre
  los siete por flat, como cualquier gasto.
- **Crédito a un departamento** — se **resta** de la cuota de ese departamento y
  **sale del saldo de la cuenta**, no del bolsillo de los demás. Es dinero que el
  edificio le devuelve a alguien (adelantó una compra, pagó de más el mes pasado).

Esta distinción es importante y la app la explica en pantalla:
*"salen del saldo de la cuenta, no de los demás vecinos"*.

---

## 5. Los dos cuadres

El motor valida el resultado antes de dejar publicar. Ambos deben dar verdadero.

### 5.1 Cuadre del agua

```
Σ agua(d) + montoComun ≈ facturaAgua        tolerancia: 0.03
```

Lo que pagan los siete por agua, más el área común, es exactamente lo que facturó
SEDAPAL. Ni un céntimo más.

### 5.2 Cuadre del mes

```
Σ cuota(d) + montoComun + Σ créditos ≈ totalMes     tolerancia: 0.05
```

Los créditos entran en el cuadre porque salen del saldo: son plata que el edificio
pone, igual que el área común.

Las tolerancias absorben el redondeo a céntimos de 7 cuotas. Si un cuadre falla, el
paso 6 del cierre **bloquea la publicación** y muestra qué no cuadra.

---

## 6. El saldo de la cuenta

Hay una cuenta bancaria conjunta. Su saldo es el resultado acumulado de todos los
meses.

```
recibido(mes) = Σ cuota(d) de los que pagaron y están CONFIRMADOS
gastado(mes)  = totalMes
delta(mes)    = recibido − gastado
saldo(mes)    = saldo(mes-1) + delta(mes)
```

**Solo cuentan los pagos confirmados.** Un pago avisado por el vecino pero no
verificado contra el banco no suma al saldo — aunque sí deja de figurar como
pendiente para ese vecino (ver 7).

En el prototipo el saldo está anclado hacia atrás: se deriva el saldo inicial para
que el último mes cierre en `SALDO_BASE = 4182.40`. **En producción esto se invierte:**
se parte de un saldo inicial real y se acumula hacia adelante. Es un cambio de una
línea en `serieSaldo()`, pero no lo pases por alto.

---

## 7. Estados de un pago

| Estado | Significado | Cuenta al saldo | Cómo se ve |
|---|---|---|---|
| `confirmado` | Verificado contra el estado de cuenta | Sí | Verde · `Al día` |
| `aviso` | El vecino dijo que pagó, falta verificar | **No** | Gris · `En verificación` |
| `null` | Sin registrar | No | Ámbar · `Sin registrar` |

**El flujo del aviso:**
1. El vecino toca "Ya pagué" en Inicio.
2. Su estado pasa a `aviso`. Para él deja de aparecer como pendiente.
3. El aviso **aparece en el panel de administración**, en la lista de pagos por
   verificar. Quien administra lo ve la próxima vez que entre.
4. El administrador lo contrasta con el estado de cuenta del banco y lo confirma.

**Bob no tiene acceso al banco.** No puede detectar depósitos, ni rellenar montos
desde el estado de cuenta, ni confirmar nada. Solo la persona que administra puede
mover un pago a `confirmado`.

---

## 8. Corrección de errores de tecleo

Al escribir las lecturas del mes es fácil equivocarse: transponer dos dígitos,
teclear uno mal. `proponerCorreccion()` intenta detectarlo.

**Cómo funciona:** genera todas las variantes del número tecleado a distancia 1
(transposiciones de dígitos adyacentes y sustituciones de un dígito), y descarta las
que no cumplen:

- la lectura debe ser mayor que la anterior (el medidor no retrocede)
- el consumo resultante debe estar entre 0.2× y 2× el promedio histórico del depto
- la suma con los otros medidores no debe superar lo facturado por SEDAPAL, ni
  quedar a más de un 8% por debajo

**Solo propone si queda exactamente una candidata válida.** Si hay dos o más, se
calla: proponer la equivocada es peor que no proponer.

La propuesta se muestra como sugerencia con dos botones: aceptar o mantener lo
tecleado. **Nunca corrige sola.**

---

## 9. Redondeo · reglas exactas

| Qué | Decimales | Cuándo |
|---|---|---|
| Lecturas de medidor | 3 | Entrada y visualización |
| Consumos en m³ | 2 | Tras cada resta |
| `precioM3` | **sin redondear** | Se arrastra a precisión completa |
| Montos en soles | 2 | Solo al final de cada cálculo |
| Porcentajes flat | 2 | Constantes |

Todos los redondeos usan `Math.round(x * 100) / 100`. **No cambies el orden de las
operaciones** — el cuadre depende de dónde cae cada redondeo.

Formato de salida: `toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
→ `1 234.56`. Para lecturas, 3 decimales.

---

## 10. Casos de prueba

Escribe estos tests antes de tocar la interfaz. Los valores salen del motor validado.

```js
// Mes normal, con lavado activo
const c = calcularMes('2026-06');
assert(c.ajustado === false);
assert(c.lavado === 1.5);
assert(c.cuadraAgua === true);
assert(c.cuadraMes === true);
assert(c.cuotas['401'].m3 === c.consumos['401'] + 1.5);
assert(Math.abs(c.sumaAgua + c.montoComun - c.facturaAgua) < 0.03);

// Suma de flats
assert(DPTOS.reduce((s,d)=>s+d.flat,0) === 100);

// Lavado desactivado: todo el bruto va al común, el total no cambia
const c0 = calcularMes('2026-06', { lavadoM3: 0 });
assert(c0.lavado === 0);
assert(c0.comunReal === c0.brutoComun);
assert(Math.abs(c0.totalMes - c.totalMes) < 0.001);   // el total NO cambia
assert(c0.cuotas['401'].total < c.cuotas['401'].total); // el 401 paga menos

// Lavado mayor que el área común disponible: no se aplica
const cBig = calcularMes('2026-06', { lavadoM3: 999 });
assert(cBig.lavado === 0);

// Reparto ajustado: forzar medidores por encima de lo facturado
const cAdj = calcularMes('2026-06', { recibo: { aguaM3: 10 } });
assert(cAdj.ajustado === true);
assert(cAdj.factor < 1);
assert(cAdj.montoComun === 0);
assert(cAdj.lavado === 0);
assert(cAdj.cuadraAgua === true);   // sigue cuadrando

// Mes con descuento de SEDAPAL (mayo 2026 trae descuento: 17.33)
const cMay = calcularMes('2026-05');
assert(cMay.facturaAgua === 325.00 - 17.33);

// El pozo a tierra sin cifra no rompe el total
assert(calcularMes('2026-06').gastos.find(g => g.concepto === 'Pozo a tierra').monto === null);

// Crédito: sale del saldo, no de los demás
const cCred = calcularMes('2026-06', { extras: [{ tipo:'credito', dpto:'301', monto: 50 }] });
assert(cCred.totalMes === c.totalMes);                       // el gasto no cambia
assert(cCred.cuotas['301'].total === c.cuotas['301'].total - 50);
assert(cCred.cuotas['101'].total === c.cuotas['101'].total); // nadie más lo paga
assert(cCred.cuadraMes === true);

// Gasto extraordinario: sí lo pagan todos
const cGas = calcularMes('2026-06', { extras: [{ tipo:'gasto', concepto:'Portón', monto: 700 }] });
assert(cGas.totalMes === c.totalMes + 700);
assert(cGas.cuotas['101'].total > c.cuotas['101'].total);
```

---

## 11. La firma de `calcularMes()`

```js
calcularMes(mesId, overrides?) → objeto | null
```

`overrides` permite recalcular con datos que el administrador está escribiendo y
todavía no guardó. Cada campo pisa la semilla individualmente:

```js
{
  recibo:   { aguaM3, aguaMonto, luz, descuento },  // cualquier subconjunto
  lecturas: { '101': 186.461, ... },                // cualquier subconjunto
  fijos:    { 'Ascensor': 700, ... },               // por concepto
  extras:   [ { tipo:'gasto'|'credito', concepto, monto, dpto? } ],
  lavadoM3: 1.5,                                     // 0 lo desactiva
}
```

**Devuelve** (los campos que la interfaz consume):

| Campo | Tipo | Qué es |
|---|---|---|
| `rec` | objeto | Recibo efectivo tras overrides |
| `consumos` | `{dpto: m³}` | Lo que midió cada medidor |
| `sumaMedida` | número | Suma de los siete medidores |
| `facturaAgua` | número | Monto menos descuento |
| `precioM3` | número | Sin redondear |
| `brutoComun` | número | Sedapal − medidores |
| `comunReal` | número | Bruto menos lavado |
| `lavado` | número | m³ reasignados al 401 este mes (0 si no aplica) |
| `ajustado` | booleano | Reparto proporcional activo |
| `factor` | número | Coeficiente del ajuste (1 si no aplica) |
| `montoComun` | número | Lo que cuesta el área común |
| `gastos` | array | Los diez conceptos con su monto |
| `totalMes` | número | Suma de gastos |
| `baseMant` | número | Total menos agua |
| `cuotas` | `{dpto: {...}}` | Ver abajo |
| `sumaAgua`, `sumaCuotas`, `totalCreditos` | número | Para el cuadre |
| `cuadraAgua`, `cuadraMes`, `cuadra` | booleano | Validaciones |

`cuotas[dpto]` contiene: `mantenimiento`, `agua`, `credito`, `total`, `m3`
(cobrados), `m3medidos`, `lavado`, `lecturaAnterior`, `lecturaActual`.
