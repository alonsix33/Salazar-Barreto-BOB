# Verificación · Fase 3 · Base de datos y backend

> **Este documento se escribió tarde**, durante la auditoría final, al descubrir
> que el entregable pedía nueve `verificacion-N.md` y había siete. Que faltara
> es un defecto de la Fase 3, y va como tal en `docs/AUDITORIA-FINAL.md`. Lo que
> hay aquí no está reconstruido de memoria: se volvió a ejecutar todo, contra
> una base creada vacía para la ocasión, y las cifras son de esa corrida.
>
> Estado: **los 6 puntos del verificador pasan.**

---

## 1. `migrate deploy` y `db seed` desde cero, contra una base vacía

Se creó una base nueva (`auditoria_cero`) en el mismo PostgreSQL, se aplicaron
las migraciones en orden y se sembró:

```
$ npx prisma migrate deploy
  20260905182535_inicial
  20260905183000_reglas_de_integridad
  20260905210000_congelar_lavado_al_publicar
  20260906001232_registro_de_bob
  All migrations have been successfully applied.

$ npx tsx prisma/seed.ts
  49 lecturas · EJEMPLO, hay que reemplazarlas
  7 recibos · EJEMPLO, hay que reemplazarlos
  41 pagos · EJEMPLO, hay que reemplazarlos
  6 meses publicados · 2026-07 en curso, sin publicar
  saldo inicial S/ 5104.06 desde 2026-01 · EJEMPLO, hay que reemplazarlo
  Listo.
```

Sin errores y sin avisos. **La semilla dice de cada bloque que es de ejemplo y
hay que reemplazarlo**, a propósito: la lista de qué tiene que cargar el cliente
está en `docs/AUDITORIA-FINAL.md` §5.

---

## 2. La base contra el motor, los ocho meses

Para cada mes de la semilla se compara el `ResultadoMes` que sale de la base
(`resultadoDeMes`) con el que sale del motor local con los mismos datos
(`calcularMes`), campo a campo: validez, total del mes, suma del agua, cuadre y
las siete cuotas.

```
meses en que la base y el motor coinciden: 7 de 8
discrepancias: 2026-07
```

**Los siete publicados coinciden. El octavo difiere por diseño, no por defecto**,
y se comprobó en vez de suponerlo:

```
base  · valido false | motivo: Todavía no se registró el recibo de este mes.
local · valido true  | total 3374.38
lecturas de 2026-07 en la base: 0
recibo de 2026-07 en la base: 0
```

2026-07 es el mes en curso: la semilla lo deja **vacío a propósito** para que se
pueda cerrar como demostración, y sus lecturas y su recibo viven en el módulo de
la semilla, que es lo que se teclearía. El motor local los lee de ahí; la base
todavía no los tiene. Que la base diga «todavía no se registró el recibo» es la
respuesta correcta.

Esto lo fija en la suite `tests/integracion/motor-vs-base.test.ts`, 7 casos.

---

## 3. Intentar romperlo

`tests/integracion/romperlo.test.ts`, **41 casos**. Cada uno manda algo que no
debería llegar y comprueba que devuelve un error con su código y **no deja un
registro corrupto**. Los ocho que pide el verificador, más lo que fue saliendo:

| Se manda | Qué pasa |
|---|---|
| Una lectura menor que la del mes anterior | Se guarda, pero el mes deja de cuadrar y **no se puede publicar** |
| Un monto negativo | 400 del esquema, y la base lo rechaza además con su `CHECK` |
| `mes` inválido (`'2026-13'`, `'junio'`, `''`) | 400 con mensaje, nunca 500 |
| Un `dpto` que no existe | 400 del esquema; la base lo rechaza también por clave foránea |
| Un crédito sin `dpto` | 400. Un gasto **con** departamento también: los gastos los pagan los siete |
| Publicar un mes ya publicado | 409, y la cuota del mes no se mueve |
| Confirmar un pago sin PIN | 401 |
| PIN incorrecto 20 veces | El **noveno** ya está bloqueado con 429 |

Y cuatro más que no estaban en la lista y valía la pena fijar:

- El PIN correcto **tampoco** entra si esa IP ya está bloqueada.
- Otra IP **no** queda bloqueada por culpa de la primera.
- Una cookie robada no revela el PIN: se prueban las diez mil firmas posibles y
  ninguna la reproduce. Es la comprobación del agujero que se cerró en la Fase 7.
- Una cookie caducada no vale aunque la firma sea buena.

**Cada escritura se comprueba en dos capas**: el esquema de Zod en el borde de la
API, y la restricción de la base por debajo. Un test por capa, porque un servicio
que se olvide de validar no puede dejar entrar el dato igualmente.

---

## 4. La auditoría

`tests/integracion/auditoria-y-avisos.test.ts`, **22 casos**. Para cada escritura
se comprueba que dejó su fila en `Auditoria` con `valorAnterior` y `valorNuevo`
correctos, **dentro de la misma transacción** que la escritura.

Lo que esto atrapó en su momento, y por lo que el test es como es: `guardarPaso`
escribía sin dejar rastro, y el «antes» de una corrección se leía **fuera** de la
transacción, así que entre la lectura y la escritura cabía otro cambio y el
registro decía que se venía de un valor que ya no era el vigente.

---

## 5. Los avisos

En el mismo archivo. Las tres reglas:

| Cuándo | Aviso |
|---|---|
| Publicar un mes | **Sí**, a los siete |
| Corregir un mes publicado | **Sí**, a los siete, con el monto anterior y el nuevo |
| Escribir en un mes en curso | **No**, a nadie |

La tercera es la que más costó. La ruta del paso 4 del cierre avisaba a los siete
cada vez que quien administra confirmaba un gasto fijo: siete notificaciones por
cada tecleo de un mes que todavía no existe para nadie. Ahora el aviso está
puesto en `publicarMes` y `corregirMes`, y las rutas del cierre pasan
`desdeElCierre`.

---

## 6. Lo que no está verificado aquí

1. **Railway no se ha ejercitado.** Todo esto corre contra un PostgreSQL 16
   local. Lo que eso deja fuera: el `pgbouncer` en modo transacción de la cadena
   de conexión con pooling, y el comportamiento de `DIRECT_URL` en las
   migraciones. `docs/DESPLIEGUE.md` explica por qué son dos cadenas distintas,
   pero explicarlo no es haberlo probado.
2. **La concurrencia se prueba con cinco casos**, no con carga. Siete personas no
   generan carrera casi nunca; el bloqueo optimista está y se comprueba, pero
   nadie le ha puesto encima cien peticiones a la vez.
3. **La semilla es de ejemplo.** Los ocho meses, los pagos y el saldo inicial son
   datos de muestra. La app calcula bien con ellos; no son los recibos reales del
   edificio.

**Bajo qué condición esto estaría equivocado**: si el PostgreSQL de Railway
aplicara los `CHECK` o las claves foráneas de otra manera que el local, la mitad
de los 41 casos de §3 estaría comprobando una defensa que allí no existe.
**Señal temprana**: correr `npm run test:integracion` una vez contra la base de
Railway, antes de cargar datos de verdad. Está en `docs/DESPLIEGUE.md` como paso
recomendado y **no se ha hecho**.
