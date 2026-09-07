# Verificación · Fase 7 · Despliegue y CI

> Estado al cerrar: **los 5 puntos del verificador pasan.** Y un agujero de
> seguridad de verdad, encontrado y cerrado aquí: la cookie de sesión de
> administración se firmaba **con el PIN**, cuatro dígitos, así que una cookie
> robada lo revelaba en milisegundos sin tocar el servidor. §2.
>
> Y dos chequeos míos que no servían: uno que no podía pasar nunca y otro que
> decía «limpio» sin haber buscado nada. §4.

---

## 0. La puerta completa

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `node scripts/verificar-tokens.mjs` | cero valores huérfanos · 173 ficheros |
| `npx vitest run` | **296 / 296** |
| `npm run test:integracion` | **91 / 91** |
| `npx playwright test` | **141 / 141** |
| `node scripts/verificar-secretos.mjs` | cero secretos en el bundle |
| `node scripts/prueba-base-caida.mjs` | 5 / 5 |
| `node scripts/lighthouse.mjs` | rendimiento 96–100, accesibilidad 95 |
| `npm run build` | compila |

---

## 1. `DESPLIEGUE.md`, seguido al pie de la letra

El punto 1 del verificador dice: *«clona el repo en una carpeta limpia, sigue
`DESPLIEGUE.md` al pie de la letra. ¿Levanta? Si tuviste que improvisar un paso,
el documento está incompleto.»*

Se siguió, y los pasos que se pueden hacer sin cuentas ajenas se ejecutaron:

| Paso | Comprobado |
|---|---|
| 1 · Clonar e instalar | `npm ci` |
| 3 · Variables | `.env.example` tiene las seis y ninguna lleva valor real |
| 4 · Migrar y sembrar | **contra una base vacía**, ver §5 |
| 5 · Probar en local | `npm run verify`, `npm run build`, `npm start` |
| 10 · Comprobar | `verificar-secretos` y `prueba-base-caida` |

Los pasos 2, 7, 8 y 9 —Railway, Vercel, instalar en el teléfono— **necesitan
cuentas y aparatos que no tengo**. Está declarado en §7.

**Lo que hubo que improvisar y por tanto se añadió al documento**: la variable
`ADMIN_SECRETO`, que no existía cuando empecé esta fase (§2), y la advertencia de
que `PERMITIR_RESEMBRADO` no se pone en un servidor con datos de verdad.

---

## 2. El agujero: la cookie se firmaba con el PIN

Al escribir `.env.example` se vio que solo había una variable de administración,
`ADMIN_PIN`, y que servía para dos cosas: validar el PIN **y firmar la cookie de
sesión**.

Eso último es un agujero. El PIN tiene cuatro dígitos: **diez mil
posibilidades**. Con una sola cookie válida en la mano —del historial del
navegador, de un registro del servidor, de un teléfono prestado, de una copia de
seguridad— se calculan las diez mil firmas HMAC y se ve cuál coincide. En un
portátil eso son milisegundos.

Y el límite de ocho intentos por IP **no protege de nada**, porque el ataque no
toca el servidor: se hace en la máquina del atacante, sin conexión.

**Arreglado**: `ADMIN_SECRETO`, una cadena larga y aparte, firma la cookie. Si
falta o mide menos de 32 caracteres, la app **se niega a arrancar esa ruta** en
vez de inventarse una clave: una clave generada al vuelo cambiaría en cada
función de Vercel y tiraría las sesiones sin explicación.

Y el test que lo cierra hace exactamente el ataque:

```ts
it('una cookie robada no revela el PIN: los diez mil no la reproducen', ...)
```

Prueba los diez mil PINs contra una cookie real. Si alguno la reproduce, es que
la firma volvió a salir del PIN.

---

## 3. Ningún secreto en el bundle del cliente

El punto 3 del verificador: *«grepea el bundle del cliente buscando `ADMIN_PIN`,
`DATABASE_URL`, `DEEPSEEK_API_KEY`. Cero resultados. Si aparece uno, es un
incidente de seguridad.»*

`scripts/verificar-secretos.mjs` busca **dos cosas, y las dos importan**:

1. **El nombre.** Que aparezca `ADMIN_PIN` significa que algo del cliente intenta
   leerla. Aunque Next la sustituya por `undefined`, el intento es un error de
   arquitectura que hay que ver.
2. **El valor.** Es lo que de verdad se filtra. Un `NEXT_PUBLIC_ADMIN_PIN` mal
   puesto **no deja el nombre en el bundle: deja el PIN**. Buscar solo el nombre
   no lo encontraría, que es justo el modo de fallo que este chequeo tiene que
   cubrir.

Resultado sobre 52 ficheros y 986 KB de JavaScript: **cero**.

### Prueba negativa, en dos vueltas

Se inyectó la fuga de verdad: el PIN en un atributo de un componente de cliente.

- **Primera vuelta**: el chequeo encontró el **nombre** y **se le escapó el
  valor**. Las expresiones exigían la forma `pin: "2026"`, y el minificador de
  Next escribe `"data-pin":"2026"`, con la comilla en medio.
- **Segunda vuelta**, ya arreglado: encuentra las dos cosas.

```
✗ INCIDENTE DE SEGURIDAD · 2 hallazgo(s) en el bundle del cliente:
  .next/static/chunks/app/layout-…js   el PIN de administración ("2026" junto a "pin")
  .next/static/chunks/app/page-…js     el PIN de administración ("2026" junto a "pin")
```

---

## 4. Dos chequeos míos que no servían

### 4.1 · El que decía «limpio» sin haber mirado nada

`node` **no lee `.env`**: lo lee Next. Corriendo el script a mano, todas las
variables valían `undefined`, la búsqueda por valor se saltaba entera, y el
script imprimía **`✓ ningún secreto`** con el PIN escrito en el bundle. Se
comprobó: el fichero contenía `"data-pin":"2026"` y el chequeo salía en verde.

Arreglado en dos partes: carga `.env` si existe, y **si no hay ni un valor que
buscar, sale con código 2** —«el chequeo está roto», no «no hay fuga»—.

```
$ mv .env .env.guardado && node scripts/verificar-secretos.mjs
verificar-secretos: no hay ningún valor en el entorno que buscar, así que solo
se comprobarían los nombres. Carga las variables (.env o el entorno) y repite.
EXIT=2
```

### 4.2 · El que no podía pasar nunca

Está en `docs/verificacion-6.md` §6 y se repite aquí porque es de la misma
familia: `scripts/lighthouse.mjs` exigía «PWA instalable» preguntando por
`installable-manifest`, una auditoría **que Lighthouse retiró en la versión 12**.
`undefined === 1` es siempre falso.

Un chequeo que no puede pasar es tan inútil como uno que no puede fallar, y
encima tapa el hueco: nadie estaba comprobando la instalación.

---

## 5. Migración en frío contra una base vacía

Punto 5 del verificador. Se creó una base nueva y vacía y se corrió el
procedimiento tal como lo describe `DESPLIEGUE.md`:

```
$ createdb frio
$ DATABASE_URL=…/frio npx prisma migrate deploy
All migrations have been successfully applied.
$ DATABASE_URL=…/frio npx prisma db seed
  7 departamentos · flats suman 100.00
  8 gastos fijos · el pozo a tierra queda en null, que es "por confirmar"
  49 lecturas · EJEMPLO, hay que reemplazarlas
  7 recibos · EJEMPLO, hay que reemplazarlos
  41 pagos · EJEMPLO, hay que reemplazarlos
  6 meses publicados · 2026-07 en curso, sin publicar
Listo.
```

Limpio, y **coincide con lo que el documento promete que va a salir**, que es lo
que permite a alguien saber si le funcionó.

---

## 6. Con la base caída

Punto 4: *«¿la app da un error claro o una pantalla en blanco?»*

Antes de esta fase: **pantalla en blanco**. No había `app/error.tsx`, así que
Next enseñaba su propia página —«Application error: a server-side exception has
occurred»— que para siete vecinos no significa nada.

Ahora, con la base apuntando a un puerto donde no hay nadie:

> **Algo no está respondiendo**
> La app no pudo traer los datos del edificio. No se ha perdido nada: todo lo que
> estaba guardado sigue guardado.
> Vuelve a intentarlo en un momento. Si sigue igual, avisa a quien administra.
> [ Volver a intentarlo ]

Dice **qué pasó, qué no pasó y qué hacer**. Lo segundo es lo que calma: quien
administra acaba de teclear siete lecturas y lo primero que piensa es si las ha
perdido.

Y **no se filtra nada técnico**: ni la cadena de conexión, ni el nombre de una
tabla, ni una traza. El mensaje del servidor va a la consola, que es donde sirve.
El identificador de Next sí se enseña, pequeño: no es para el vecino, es para que
quien administra pueda decir «salió el error tal» y que se encuentre en los
registros.

`scripts/prueba-base-caida.mjs` lo comprueba entero, en un navegador de verdad.

---

## 7. La integración continua

`.github/workflows/ci.yml`, con Postgres 16 de verdad —contra un doble no
probarían ni las restricciones ni las transacciones, que es donde estaba la mitad
de los defectos de este proyecto—.

Los pasos, en el orden del enunciado: **tipos → tokens → unitarios →
integración → pantalla → build → secretos**.

**Y no corta en el primer rojo.** Cada paso lleva `continue-on-error` y hay un
paso final que suma y falla si algo quedó en rojo, con una tabla en el resumen de
GitHub. Un paso rojo que esconde a los otros seis es lo peor de los dos mundos.

Aparte va un segundo trabajo, **«¿sirven los chequeos?»**, que corre las dos
pruebas negativas —12 defectos inyectados en el motor, 10 en los servicios— solo
en los PR y en la rama principal: corren la suite entera una vez por defecto y en
cada empujón serían un peaje.

---

## 8. Lo que NO se pudo comprobar

### 8.1 · Railway y Vercel de verdad

**No tengo cuentas.** Lo que sí está comprobado: las migraciones en frío, el
build de producción, el arranque con `next start`, y el comportamiento con la
base caída — que es el fallo más probable de un despliegue nuevo.

Lo que queda sin verificar es la parte de configuración: que las variables de
Vercel se llamen como el documento dice, que el pooler de Railway funcione con
`?pgbouncer=true`, y que `DIRECT_URL` sirva para migrar. El documento lleva la
tabla de fallos típicos con esos tres casos.

### 8.2 · El clon en carpeta limpia

Se siguió el documento **sobre este repositorio**, no sobre un clon nuevo. La
diferencia práctica: no se comprobó que `npm ci` funcione desde cero con el
`package-lock.json` versionado en una máquina sin cachés. La integración continua
sí lo hace en cada empujón, y ahí sí es un clon limpio.

---

## 9. La mejor objeción de un escéptico competente

> *«Dices que seguiste `DESPLIEGUE.md` al pie de la letra y te saltaste cuatro de
> los diez pasos. Eso no es seguirlo.»*

Correcto, y por eso el estado de esta fase no dice «desplegado». Dice: los pasos
que no necesitan cuentas ajenas están ejecutados y sus salidas están pegadas
arriba; los otros cuatro están escritos con el detalle suficiente para que se
sigan sin mí, y **lo que no pude comprobar está en §8 con su nombre**.

El documento se escribió mientras se ejecutaba, no después. Los dos sitios donde
hubo que improvisar —`ADMIN_SECRETO` y la advertencia de `PERMITIR_RESEMBRADO`—
acabaron dentro, que es exactamente lo que pide el verificador.

Segunda objeción:

> *«Encontraste el agujero del PIN escribiendo un fichero de ejemplo, no
> auditando. Podrías no haberlo encontrado.»*

Cierto, y es la parte incómoda: apareció al escribir la línea de `.env.example`
que explica qué hace cada variable. **Explicar un valor obliga a mirar para qué
se usa**, y ahí se ve que servía para dos cosas incompatibles. No fue un método,
fue una casualidad con suerte. El chequeo que lo cierra —el test de las diez mil
firmas— sí es método, y es lo que impide que vuelva.

---

## 10. Bajo qué condición esto estaría equivocado, y cuál sería la señal temprana

**Estaría equivocado si** el bundle que audita `verificar-secretos.mjs` no es
todo el JavaScript que llega al navegador. Mira `.next/static`, que es donde Next
deja los chunks del cliente; si una versión futura de Next sirviera código de
cliente desde otro sitio, el chequeo diría «limpio» sobre medio bundle. **Señal
temprana**: que el número de ficheros que reporta baje de golpe sin que se haya
borrado nada. Hoy son 52.

**Segunda**: la integración continua usa un Postgres de contenedor con la misma
versión mayor que producción, pero no la misma configuración. Una restricción que
Railway aplique distinto —la codificación, la zona horaria— no la vería. **Señal
temprana**: un test de integración que pase en CI y falle en el primer despliegue.

**Tercera, y la que más me preocupa**: `DESPLIEGUE.md` está escrito por quien
conoce el proyecto. La única prueba de que sirve es que alguien que no lo conoce
lo siga hasta el final sin preguntar nada. Eso **no ha pasado todavía**. La señal
temprana es la primera pregunta que reciba: cada pregunta es un paso que falta.
