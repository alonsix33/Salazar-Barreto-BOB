# Por qué la app iba lenta, y qué se hizo

> Medido, no razonado. Todos los números de este documento salen de una medición
> concreta, con el comando al lado. Fecha: 13 de septiembre de 2026.

---

## 1. El síntoma

Con la app ya en producción —Vercel + Railway— y la base cargada con el año:

```
ruta                pasada 1     pasada 2     pasada 3
/                   12.885 s     12.229 s     12.274 s
/mi-departamento    30.361 s     31.859 s     31.834 s
/historial          39.420 s     39.444 s     39.471 s
/avisos              0.848 s      0.627 s      0.671 s
```

Tres pasadas casi idénticas: **no eran arranques en frío**. `/avisos` iba bien, y
eso ya señalaba dónde mirar: es la única pantalla que no calcula meses.

### Una medición anterior estaba mal, y lo dijo tarde

Antes de esto informé que producción respondía en 0.26–0.66 s. Era falso: había
medido **sin la cookie `sb_dpto`**, o sea contra el onboarding, que no toca la
base. La pantalla equivocada. La corrección está arriba; la lección es que una
medición de una app con sesión no vale sin la sesión puesta.

---

## 2. La causa

No era el cálculo. Contando las consultas con el log de sentencias de Postgres:

```
serieDelSaldo()              · Inicio            26 consultas ·  26 ms
pagosDe + resultadoDeMes     · Inicio y El mes    8 consultas ·   8 ms
balanceDelDpto + historial   · Mi departamento   91 consultas ·  57 ms
listaDeMeses()               · Historial         66 consultas ·  32 ms
```

Cada mes se leía por separado, con sus seis consultas —recibo, lecturas,
lecturas del mes anterior, gastos fijos, extras, lavado— y se calculaba aparte.
Con la base al lado son 57 ms y no se nota. Con la app en Vercel y la base en
Railway, **cada consulta es un viaje por internet**, y con
`?connection_limit=1` —que es lo que se recomienda para serverless— ni siquiera
van en paralelo: van en fila.

La aritmética cuadra con lo medido:

```
91 consultas × 330 ms de ida y vuelta ≈ 30 s      (medido: 31.8 s)
66 consultas × 330 ms                  ≈ 22 s      (medido: 39.4 s, más el resto de la pantalla)
```

Que el modelo prediga el número medido es lo que convierte la hipótesis en
diagnóstico.

---

## 3. Lo que se hizo

### 3.1 Una tanda de consultas para todo · `lib/datos/almanaque.ts`

Se leen **las siete tablas enteras de una vez** y los meses se calculan en
memoria con el mismo motor. El edificio son siete departamentos y una docena de
meses: unas trescientas filas. Traerlas todas cuesta menos que preguntar por una.

`06` §2 sigue en pie: **no se guarda ninguna cuota calculada.** Esto no lee
`Cierre.instantanea` para enseñar nada; lee las entradas y llama a `calcularMes`,
igual que antes. Corregir una lectura de mayo sigue recalculando todo lo derivado.

### 3.2 Caché con etiqueta, que se tira sola al escribir

La tanda va envuelta en `unstable_cache` con la etiqueta `edificio`, y la
invalida **cualquier escritura que pase por Prisma**, desde la extensión de
`lib/datos/prisma.ts`. Es el único sitio, a propósito: la alternativa era un
`revalidateTag` al final de cada servicio, y basta olvidarlo en uno —o escribir
un servicio nuevo el mes que viene— para que un vecino vea una cuota vieja sin
que nada se ponga rojo.

`responder()` repite la invalidación **después del commit**, porque la de la
extensión ocurre dentro de la transacción y entre las dos hay una rendija.

Hay además un `revalidate` de 300 s como red de seguridad: cubre el caso de que
alguien escriba por fuera de la app, desde la consola de Railway.

Las pantallas de administración leen con `almanaqueFresco()`, **sin esa caché**:
quien está cerrando el mes acaba de teclear y tiene que ver lo suyo al instante.
Siguen siendo una sola tanda, así que son rápidas igual.

### 3.3 Un esqueleto al cambiar de pestaña

Cuatro `loading.tsx`. Sin ellos, Next deja la pantalla anterior congelada hasta
que llega la nueva y el vecino toca otra vez creyendo que no registró el toque.

---

## 4. El resultado, medido

Consultas **por petición HTTP, dentro del servidor de Next de verdad** —que es la
única medida que vale: fuera de Next no hay ni `cache()` de React ni
`unstable_cache`—:

```
ruta                antes   1ª tras escribir   2ª (con caché)   3ª
/                      26     11 q   83 ms      2 q  36 ms      2 q  33 ms
/historial             66      9 q   39 ms      0 q  27 ms      0 q  37 ms
/mi-departamento       91      9 q   42 ms      0 q  37 ms      0 q  24 ms
/mes/2026-08            8      9 q   41 ms      0 q  29 ms      0 q  23 ms
/avisos                 2      1 q   19 ms      2 q  19 ms      1 q  18 ms
```

Las 9 consultas son la tanda entera y se lanzan a la vez. Las 2 que quedan en `/`
son el contador de avisos sin leer, que no es parte de la foto.

Proyectado a Railway, con 330 ms de ida y vuelta:

| | antes | ahora, tras escribir | ahora, con caché |
|---|---|---|---|
| Mi departamento | ~30 s | ~3 s con `connection_limit=1`, ~0.7 s con 5 | ~0 |
| Historial | ~22 s | igual | ~0 |

Y las pruebas, después de todo esto: **502 de unidad y 197 de integración en
verde**, 18 de 18 defectos inyectados detectados en el motor y las reglas de
lectura. La cifra que importa no es la primera: es la segunda.

---

## 5. Lo que falta del lado de quien despliega

Dos ajustes que no están en el código y que valen más que nada de lo anterior si
están mal. Los dos, en `docs/DESPLIEGUE.md` §«Que no se ponga lenta»:

1. **Que Vercel y Railway estén en la misma región.** Si una está en Estados
   Unidos y la otra en Europa, cada viaje son 150 ms o más.
2. **`?connection_limit=5` en `DATABASE_URL`.** Con `=1`, las consultas que la
   app lanza a la vez se ponen en fila: la tanda de 9 paga 9 viajes seguidos en
   vez de 2.

---

## 6. Un chequeo que se tiró porque no probaba nada

El chequeo obvio de que la caché se invalida es: levantar la app, calentar la
caché, escribir por la API y mirar si la pantalla cambia. Se escribió, dio verde,
y **seguía dando verde con la invalidación arrancada de raíz** —`revalidateTag`
sustituido por una función vacía, las cuatro pantallas seguían enseñando lo
nuevo—.

El motivo: en un `next start` cualquier POST vacía la caché de datos del proceso.
Comprobado por separado: un cambio hecho por SQL directo **no** se veía; el mismo
cambio seguido de un POST a una ruta cualquiera, **sí**. O sea que la prueba
pasaba por un camino que no es el que se quiere comprobar, y que en Vercel no
existe: allí la caché la comparten varias instancias y solo la etiqueta la tira.

Un chequeo así es peor que no tener ninguno, porque apaga la sospecha. Se tiró y
se sustituyó por `tests/integracion/invalidar-cache.test.ts`, que comprueba lo
que sí se puede ver:

- que la invalidación ocurre en cada operación de escritura —`create`, `update`,
  `upsert`, `delete`, y dentro de una transacción—,
- que **no** ocurre en una lectura, porque si no la caché no serviría de nada,
- y que no queda ninguna operación del cliente de Prisma sin clasificar, para que
  el día que Prisma añada una, el test se ponga rojo y haya que decidir de qué
  lado va.

Su prueba negativa está en `scripts/prueba-negativa-integracion.mjs`.

---

## 6 bis. Un defecto que metí al hacer esto, y cómo salió

Al montar la foto del edificio **reimplementé dentro de `almanaque.ts` la
herencia del lavado y la vigencia de los gastos fijos**. Eran copias de lo que ya
estaba en `mes.ts`.

Este proyecto ya había pagado ese error una vez: `corregirMes` tenía su propia
copia de `entradasDeMes`, las dos se separaron, y la de allí no heredaba la marca
del lavado del mes anterior, así que el aviso que recibían los siete —«el 401
pasó de X a Y»— citaba una Y que la app no cobraba.

Lo que lo destapó no fue ningún test en rojo: **las 699 pruebas seguían en
verde**, y las dos copias decían lo mismo el día que se escribieron. Lo destapó
la prueba negativa: la inyección «que el lavado vuelva a reescribir el pasado»,
que llevaba meses poniéndose roja, dejó de detectarse. No porque faltara un test,
sino porque las pantallas ya no pasaban por el código que se estaba rompiendo.

Es exactamente el trabajo que hace un defecto inyectado y que no hace ninguna
suite en verde: un chequeo que nunca se vio fallar no es un chequeo.

**El arreglo no fue añadir un test**, fue quitar la copia: la regla vive en
`lib/datos/filas.ts`, una vez, y recibe filas llanas. Quien las trae —Prisma
dentro de una transacción, o la foto— es lo único que cambia. Y con ella, seis
inyecciones nuevas en `scripts/prueba-negativa.mjs` y
`lib/datos/__tests__/filas.test.ts`, que cubre la herencia del mes anterior: se
heredaba el interruptor pero no el valor congelado, y no había un solo test que
lo dijera.

---

## 7. Bajo qué condición esto estaría equivocado

- **Si el edificio creciera.** La foto trae todas las filas de todas las tablas.
  Con siete departamentos y una docena de meses son ~300 filas. A cincuenta meses
  siguen siendo ~1.200 y aguanta; a mil meses, no. La señal temprana: el tiempo
  de la primera petición tras escribir dejando de ser ~40 ms.
- **Si alguien escribiera en la base sin pasar por Prisma** y esperara verlo al
  instante. No lo verá hasta 300 s después. Es deliberado, y está dicho en
  `DESPLIEGUE.md`.
- **Si Vercel repartiera las peticiones entre muchas instancias con cachés
  separadas.** La etiqueta invalida el Data Cache, que en Vercel es compartido,
  así que no debería pasar; si pasara, el síntoma sería un número que cambia al
  recargar y vuelve atrás.
- **Si el orden de los gastos extra dejara de ser determinista.** Se ordenan por
  `[creadoEn, id]`; dos extras del mismo milisegundo con el mismo id no existen.
