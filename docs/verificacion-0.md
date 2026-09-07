# Verificación 0 · Lectura y plan

Las cinco preguntas del verificador adversario de la Fase 0, respondidas por escrito
antes de tocar código.

---

## 1. Gasto extraordinario vs. crédito. ¿Quién paga cada uno?

Son dos mecanismos opuestos que se parecen solo en que los dos los añade el
administrador en el paso 5 del cierre.

**Gasto extraordinario.** Se suma a `totalMes`. Como `baseMant = totalMes − facturaAgua`
y `mantenimiento(d) = round2(baseMant × flat(d) / 100)`, ese gasto entra en la base y se
reparte entre los siete por porcentaje de participación, igual que la guardianía o el
ascensor. **Lo pagan los siete vecinos, cada uno según su flat.** Si el portón cuesta
S/ 700, el 202 (flat 20.12 %) pone ~S/ 140.84 y el 201 (flat 10.21 %) pone ~S/ 71.47.

**Crédito a un departamento.** No toca `totalMes` en absoluto. Se resta **solo** de la
cuota de ese departamento:

```
cuota(d) = mantenimiento(d) + agua(d) − credito(d)
```

`credito` no aparece en la lista de gastos, no entra en `baseMant`, y por lo tanto **no
sube la cuota de nadie más**. El dinero sale del **saldo de la cuenta conjunta**, no del
bolsillo de los otros seis: es plata que el edificio le devuelve a alguien que adelantó
una compra o pagó de más el mes pasado.

Por eso el crédito entra en el cuadre del mes como una línea propia:

```
Σ cuota(d) + montoComun + Σ créditos ≈ totalMes        (tolerancia 0.05)
```

Si no estuviera ahí, el cuadre fallaría por exactamente el monto del crédito: el
edificio gastó `totalMes` pero los siete pagaron `totalMes − crédito`. La diferencia la
pone la cuenta. Es la misma naturaleza que el área común del agua, que también sale del
saldo y también aparece como línea propia en el cuadre.

La app lo dice en pantalla con estas palabras: *"salen del saldo de la cuenta, no de los
demás vecinos"* (`01` §4.2, `04` paso 6).

Los tests que lo fijan (`01` §10):

```js
cCred.totalMes === c.totalMes                        // el gasto del edificio no cambia
cCred.cuotas['301'].total === c.cuotas['301'].total - 50
cCred.cuotas['101'].total === c.cuotas['101'].total  // nadie más lo paga
cCred.cuadraMes === true
```

---

## 2. ¿Por qué el lavado del 401 se reasigna y no se suma?

El 401 lava su auto una vez por semana con la manguera del caño común. **Esa agua ya
está dentro de lo que SEDAPAL facturó**, porque SEDAPAL mide el medidor matriz del
edificio, que incluye el caño común.

**La primera versión la sumaba como cargo aparte.** El resultado era que los siete
pagaban, entre todos, más de lo que SEDAPAL cobró: el edificio recaudaba `facturaAgua +
lavado × precioM3` para pagar una factura de `facturaAgua`. **Sobraba dinero sin dueño.**
No era de nadie: ni del 401, que ya lo había pagado, ni de los otros seis, que habían
pagado su consumo completo, ni del edificio, que no tenía por qué cobrar de más. El
cuadre del agua (`Σ agua(d) + montoComun ≈ facturaAgua`) fallaba por ese monto, y un
cuadre que falla en una app cuya razón de existir es que cada sol sea explicable es un
defecto que destruye la confianza en todos los demás números.

La reasignación arregla el origen del problema. Los m³ del lavado **se restan del área
común y se le suman al 401**:

```
comunReal        = round2(brutoComun − lavado)
m3Cobrados(401)  = consumo(401) + lavado
m3Cobrados(otros)= consumo(otros)
```

El total de m³ cobrados no cambia: se movieron de una bolsa a otra. `Σ m3Cobrados +
comunReal` sigue siendo `m3Sedapal`, así que **el total del edificio no cambia ni un
sol** y el cuadre da exacto. Lo que cambia es quién paga: antes esos 1.50 m³ los pagaban
los siete repartidos como área común; ahora los paga el 401, que es quien los usó.

Consecuencia comprobable, y es uno de los tests de propiedad de la Fase 1: **cambiar
`lavadoM3` nunca cambia `totalMes`.** Solo redistribuye. Al desactivarlo, el 401 paga
menos y el área común sube; el total del mes es idéntico al céntimo.

---

## 3. ¿Qué es el reparto ajustado, cuándo se activa y cómo se llama en la interfaz?

**Qué es.** El mecanismo que se activa cuando la suma de los siete medidores individuales
**supera** los m³ que facturó SEDAPAL. Pasa por desfases en las fechas de lectura —el
medidor matriz y los individuales no se leen el mismo día—, no por fraude.

**Cuándo se activa.** Cuando `brutoComun = round2(m3Sedapal − sumaMedida)` sale
**negativo**. Ese es el único disparador: `ajustado = brutoComun < 0`.

**Qué hace.** No se puede cobrar más agua de la que llegó en el recibo, así que a todos
se les descuenta la misma proporción:

```
factor          = m3Sedapal / sumaMedida        // siempre < 1
m3Cobrados(d)   = round2(consumo(d) × factor)
montoComun      = 0                              // no hay área común que repartir
lavado          = 0                              // tampoco hay de dónde sacarlo
```

Nadie sale beneficiado ni perjudicado respecto de los demás: el descuento es
proporcional. Y el lavado se desactiva porque su condición es tener área común de donde
restarlo, y aquí no hay.

**Cómo se llama en la interfaz: no se llama.** No aparece la palabra "ajustado", ni
"reparto ajustado", ni "Ruta A" ni "Ruta B" ni ningún nombre interno. Se explica lo que
pasó, con los números del mes:

> *"Los medidores sumaron 82.40 m³ y SEDAPAL facturó 81. Como no se puede cobrar más de
> lo que llegó en el recibo, a cada uno se le descontó la misma proporción."*

Ese texto está en `03` §P2 punto 5 y se repite en la hoja `calculo`, sección 3, donde el
título de la sección cambia de *"Qué pasó con la diferencia"* a *"Por qué se ajustó"*.
`ajustado` y `factor` son nombres de campo del `ResultadoMes`, no texto de pantalla.

---

## 4. ¿Cuántos estados tiene un pago y cuál no suma al saldo?

**Tres** (`01` §7):

| Estado | Significado | ¿Suma al saldo? | Cómo se ve |
|---|---|---|---|
| `confirmado` | Verificado contra el estado de cuenta del banco | **Sí** | Verde · `AL DÍA` |
| `aviso` | El vecino dijo que pagó, falta verificar | **No** | Gris · `EN VERIFICACIÓN` |
| `null` (sin registrar) | No hay nada asociado a ese mes | **No** | Ámbar · `SIN REGISTRAR` |

**El que no suma y es fácil equivocarse es `aviso`.** Es el caso interesante porque
tiene dos verdades a la vez, y las dos importan:

- **Para el saldo, no existe.** `recibido(mes)` cuenta solo los `confirmado`. Un aviso
  es la palabra de alguien, no un depósito verificado; contarlo inflaría el saldo de la
  cuenta con dinero que puede no estar. Por eso `serieSaldo()` filtra por
  `estado === 'confirmado'` y nada más.
- **Para el vecino, sí cuenta.** Deja de figurar como pendiente, la píldora pasa a
  `EN VERIFICACIÓN`, y desaparecen los botones de pagar. No se le sigue pidiendo algo
  que ya dijo que hizo. Eso es "vecinos, no morosos" aplicado a un estado de datos.

El aviso aparece además en el panel de administración, en la lista de pagos por
verificar, y solo una persona —contrastando contra el estado de cuenta— puede moverlo a
`confirmado`. **Bob no puede.** No tiene acceso al banco.

---

## 5. ¿Qué genera un aviso a los siete vecinos y qué no?

La distinción que gobierna todo es **si el mes ya está publicado o sigue en curso**
(`06` §3).

### Sí genera aviso

| Acción | Aviso |
|---|---|
| **Publicar un mes** (paso 7 del cierre) | *"Ya está el cierre de julio"* |
| **Confirmar un pago** | *"Se confirmó el pago del 301 de julio"* |
| **Corregir un dato de un mes ya publicado** | *"Se corrigió la lectura del 202 en mayo. Su cuota pasó de S/ 498.20 a S/ 512.40."* |
| **Cambiar un gasto fijo** | *"El ascensor pasó de S/ 680.00 a S/ 720.00 desde agosto"* |
| **Activar o desactivar una reasignación** | *"El lavado del 401 queda desactivado en julio"* |

### No genera aviso

**Escribir datos en un mes que todavía no se publicó.** Toda la Fase 5 —las siete
lecturas, la factura de agua, la luz, los gastos fijos, los extras, la casilla del
lavado— se teclea, se corrige y se vuelve atrás las veces que haga falta **sin notificar
a nadie**. Ningún vecino ve nada hasta el paso 7.

**Por qué la distinción no es un detalle de comodidad:** sin ella, cerrar un mes serían
doscientas notificaciones. Siete lecturas tecleadas con dos correcciones cada una, más
cuatro campos de recibo, más diez gastos fijos, cada tecla generando un aviso a siete
personas. La campana se volvería ruido, la gente la apagaría, y entonces el aviso que
**sí** importa —*"ya está el cierre de julio, tu cuota es S/ 388.96"*— llegaría a una
campana que nadie mira. El requisito de que todo movimiento sea visible se cumple
igual: queda en `Auditoria`, con campo, valor anterior, valor nuevo, quién y cuándo. Lo
que se filtra es **qué merece interrumpir a siete personas**, no qué se registra.

La regla en una línea, tal como se implementa en `lib/servicios/`: **toda escritura
escribe en `Auditoria` siempre; escribe en `Aviso` solo si el mes ya estaba publicado, o
si la acción es una de las cinco de la tabla de arriba.**

Corolario que la Fase 3 verifica ejecutando: publicar un mes genera exactamente un
aviso; escribir una lectura en un mes en curso genera cero.

---

## Estado de la Fase 0

- Los siete documentos de `mockup/` (`README` y `01`–`06`) leídos completos. ✅
- `Salazar Barreto v2.dc.html` leído: marcado de las seis pantallas de vecino y de la
  navegación. Las hojas modales, el numpad, el wizard y el panel de administración se
  generan en el script del prototipo y se leen al implementar las fases 4, 5 y 8, que es
  cuando hacen falta. ✅
- `support.js` **no** se abrió. Es andamiaje de la herramienta de diseño. ✅
- `datos-edificio.js` leído línea por línea. ✅
- `docs/PLAN.md` escrito con árbol de archivos, decisiones y las ocho dudas que resolví
  solo, cada una con su criterio. ✅

### Verificado ejecutando, no leyendo

Antes de escribir una línea del motor, se ejecutó `datos-edificio.js` en Node para
extraer los valores de referencia de los ocho meses. Es la fuente de verdad contra la
que la Fase 1 compara al céntimo, y evita "verificar" el port contra mi propia lectura
del original:

```
node scratchpad/ref.mjs > scratchpad/ref.json
```

Muestra de lo que devuelve (junio 2026): `totalMes 3317.98`, `facturaAgua 325.00`,
`precioM3 4.166666666666667`, `sumaMedida 74.88`, `brutoComun 3.12`, `comunReal 1.62`,
`lavado 1.5`, `montoComun 6.75`, `cuadraAgua true`, `cuadraMes true`, y la cuota del 401
en `384.33` con `18.90 m³` cobrados sobre `17.40 m³` medidos.

### Bajo qué condición esto estaría equivocado

Si el `datos-edificio.js` del handoff no fuera el motor validado contra recibos reales
sino una copia desactualizada. La señal temprana sería que los 14 casos de `01` §10 —que
están escritos a mano en el documento, no generados desde el archivo— no coincidieran
con lo que devuelve el archivo. La Fase 1 los corre todos precisamente por eso.
