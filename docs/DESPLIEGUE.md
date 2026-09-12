# Desplegar la app del edificio, desde cero

> Escrito para que lo sigas tú solo, sin que nadie esté delante. Cada paso lleva
> el comando exacto y **cómo saber que salió bien**. Si en algún punto tienes que
> improvisar, este documento está incompleto: dímelo y lo arreglo.
>
> Tiempo aproximado la primera vez: **una hora**, casi toda esperando.

---

## Antes de empezar

Necesitas tres cuentas, las tres con plan gratuito suficiente para siete vecinos:

| Para qué | Dónde | Coste |
|---|---|---|
| La base de datos | [railway.app](https://railway.app) | gratis hasta 5 GB |
| La app | [vercel.com](https://vercel.com) | gratis |
| El código | [github.com](https://github.com) | gratis |

Y en tu computadora:

```bash
node --version    # tiene que decir v20 o más
git --version
```

Si Node es más viejo, instálalo desde [nodejs.org](https://nodejs.org) y vuelve.

---

## Tabla de claves · de dónde sale cada una y dónde va

Trece variables. Solo cinco son obligatorias para que la app arranque; las demás
tienen un valor por defecto sensato o se pueden dejar vacías.

| Variable | ¿De dónde la saco? | ¿Dónde la configuro? | ¿Obligatoria? |
|---|---|---|---|
| `DATABASE_URL` | Railway → servicio Postgres → pestaña **Variables** → `DATABASE_URL`. Al final le añades `?pgbouncer=true&connection_limit=1` | `.env` local **y** Vercel | **Sí** |
| `DIRECT_URL` | La misma de Railway, **sin** el `?pgbouncer=...` | `.env` local **y** Vercel | **Sí** |
| `ADMIN_PIN` | Lo eliges tú. Cuatro dígitos | `.env` local **y** Vercel | **Sí** |
| `ADMIN_SECRETO` | Lo generas: `openssl rand -base64 32` | `.env` local **y** Vercel | **Sí** |
| `NEXT_PUBLIC_APP_URL` | La URL que te da Vercel al desplegar | `.env` local **y** Vercel | **Sí** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` → mitad **pública** | `.env` local **y** Vercel | No (sin ella no hay push) |
| `VAPID_PRIVATE_KEY` | El mismo comando → mitad **privada** | `.env` local **y** Vercel. **Nunca** con `NEXT_PUBLIC_` | No (sin ella no hay push) |
| `VAPID_SUBJECT` | Un `mailto:` tuyo de contacto | `.env` local **y** Vercel | No (por defecto vale) |
| `BOB_MODO` | Lo eliges: `determinista` (sin coste) o `deepseek` | `.env` local **y** Vercel | No (`determinista` por defecto) |
| `DEEPSEEK_API_KEY` | platform.deepseek.com → API keys. Solo si `BOB_MODO=deepseek` | `.env` local **y** Vercel | No |
| `DEEPSEEK_MODELO` | Déjala vacía salvo que quieras fijar una versión | `.env` local **y** Vercel | No |
| `DEEPSEEK_URL` | Déjala vacía. Solo para apuntar a un simulador | `.env` local | No |
| `PERMITIR_RESEMBRADO` | **Déjala vacía en producción.** Con valor, abre una ruta que borra la base entera | `.env` local, solo para pruebas | No |

**La regla de oro del prefijo:** `NEXT_PUBLIC_` significa "esto viaja al navegador
del vecino". Solo lo llevan las dos que no son secretas: la URL de la app y la
clave **pública** de push. Si le pones ese prefijo al PIN, a `ADMIN_SECRETO` o a
`VAPID_PRIVATE_KEY`, dejan de ser secretos y cualquiera los lee. Hay un chequeo
que revienta el despliegue si eso pasa (`node scripts/verificar-secretos.mjs`).

**Dónde se pegan en Vercel:** panel del proyecto → *Settings* → *Environment
Variables* → una por una, marcando los tres entornos (Production, Preview,
Development). Después de añadirlas hay que **volver a desplegar** para que las
tome.

## Paso 1 · El código en tu computadora

```bash
git clone https://github.com/TheLabReset/Salazar-Barreto-BOB.git
cd Salazar-Barreto-BOB
npm ci
```

**Salió bien si**: `npm ci` termina sin la palabra `ERR!` y aparece una carpeta
`node_modules`.

---

## Paso 2 · La base de datos en Railway

1. Entra a [railway.app](https://railway.app) → **New Project** → **Deploy
   PostgreSQL**. Tarda un minuto.
2. Cuando aparezca el servicio **Postgres**, entra → pestaña **Variables**.
3. Copia estas dos, que vas a necesitar en el paso 3:
   - `DATABASE_URL`
   - `DATABASE_PUBLIC_URL` — es la misma pero accesible desde fuera de Railway.

4. **Activa la copia de seguridad diaria.** Es lo único de este documento que no
   se puede dejar para después: son las cuentas de siete familias.

   En el servicio Postgres → **Settings** → **Backups** → activa **Daily**.
   Comprueba que dice *Enabled* antes de seguir.

**Salió bien si**: en Settings → Backups pone «Daily backups enabled», y tienes
las dos URL copiadas en algún sitio.

---

## Paso 3 · Las variables de entorno, en tu computadora

```bash
cp .env.example .env
```

Abre `.env` y rellena:

```bash
# Las dos de Railway. La pública lleva `?pgbouncer=true&connection_limit=1`
# añadido al final: Vercel abre y cierra funciones sin parar, y sin eso la base
# se queda sin conexiones.
DATABASE_URL="<DATABASE_PUBLIC_URL de Railway>?pgbouncer=true&connection_limit=1"
DIRECT_URL="<DATABASE_PUBLIC_URL de Railway>"

# El PIN de cuatro dígitos del panel de administración. Elígelo tú.
ADMIN_PIN="0000"

# La clave que firma la sesión de administración. Genérala así:
#   openssl rand -base64 32
ADMIN_SECRETO="<lo que salga del comando de arriba>"

BOB_MODO="determinista"
DEEPSEEK_API_KEY=""

# Notificaciones push (opcional). Genera las dos claves una sola vez con:
#   npx web-push generate-vapid-keys
# La pública va con NEXT_PUBLIC_; la privada nunca. Vacías, no hay push y la app
# funciona igual (el aviso de WhatsApp lo cubre).
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:tu-correo@ejemplo.pe"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
PERMITIR_RESEMBRADO=""
```

**Dos cosas importantes:**

- **`ADMIN_PIN` y `ADMIN_SECRETO` no llevan `NEXT_PUBLIC_` delante.** Con ese
  prefijo, Next los mete en el JavaScript que descarga el navegador y dejan de
  ser secretos. Hay un chequeo que lo comprueba: `npm run verificar-secretos`.
- **`ADMIN_SECRETO` no es el PIN.** Si fuera el PIN, cualquiera con una cookie de
  sesión en la mano podría sacarlo probando diez mil combinaciones en su
  computadora, sin tocar el servidor. Tienen que ser cosas distintas.

**Salió bien si**: `.env` tiene las seis variables y `ADMIN_SECRETO` mide más de
32 caracteres.

---

## Paso 4 · Crear las tablas y cargar los datos

```bash
npx prisma migrate deploy
npx prisma db seed
```

**Salió bien si**: el segundo comando termina diciendo `Listo.` y una lista con
`7 departamentos`, `8 gastos fijos`, `6 meses publicados`.

Para verlo con tus ojos:

```bash
npx prisma studio
```

Se abre una pestaña del navegador con las tablas. Cierra con `Ctrl+C`.

> **Los datos que carga la semilla son de ejemplo**, menos los siete
> departamentos con sus metrajes y los gastos fijos, que son reales. Las
> lecturas, los recibos y los pagos hay que reemplazarlos por los de verdad: está
> en la lista de `docs/AUDITORIA-FINAL.md`.

---

## Paso 5 · Probarlo en tu computadora antes de subir nada

```bash
npm run verify        # tipos, tokens de diseño y tests unitarios
npm run test:integracion
npm run build
npm start
```

Abre <http://localhost:3000>. Elige el departamento `401`. Deberías ver la cuota
de junio y la tarjeta oscura con el saldo.

Para el panel: **Avisos → Administración → tu PIN**.

**Salió bien si**: `npm run verify` termina en verde y la app abre. Si `npm run
build` falla, **no sigas**: lo mismo va a fallar en Vercel.

Corta con `Ctrl+C`.

---

## Paso 6 · Subir el código a GitHub

Si clonaste el repositorio, ya está en GitHub y puedes saltar al paso 7.

Si empiezas de un directorio suelto:

```bash
git init
git add -A
git commit -m "La app del edificio"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

**Salió bien si**: en github.com ves los ficheros, y **NO ves el fichero `.env`**.
Si lo ves, bórralo del repositorio inmediatamente y cambia el PIN y el
`ADMIN_SECRETO`: han quedado públicos.

---

## Paso 7 · La app en Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → elige tu
   repositorio.
2. Vercel detecta Next.js solo. **No cambies nada** de Framework, Build Command
   ni Output Directory.
3. Antes de darle a Deploy, abre **Environment Variables** y añade **seis**:

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | la de Railway, con `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | la de Railway, sin nada añadido |
   | `ADMIN_PIN` | tu PIN de cuatro dígitos |
   | `ADMIN_SECRETO` | la cadena larga de `openssl rand -base64 32` |
   | `BOB_MODO` | `determinista` |
   | `NEXT_PUBLIC_APP_URL` | déjalo vacío por ahora, se rellena en el paso 8 |

   **`PERMITIR_RESEMBRADO` no se pone.** Esa variable abre una ruta que borra la
   base entera. En un servidor con datos de verdad se queda fuera, siempre.

4. **Deploy.** Tarda dos o tres minutos.

**Salió bien si**: Vercel dice *Ready* y te da una URL tipo
`https://algo-algo.vercel.app`. Ábrela: tiene que verse el onboarding
—«¿Cuál es tu departamento?»—.

**Si sale una pantalla que dice «Algo no está respondiendo»**: la app está bien y
la base no se alcanza. Repasa `DATABASE_URL` en las variables de Vercel; el fallo
casi siempre es haber puesto la URL interna de Railway en vez de la pública.

---

## Paso 8 · La URL definitiva

1. Copia la URL que te dio Vercel.
2. Vercel → **Settings** → **Environment Variables** → edita
   `NEXT_PUBLIC_APP_URL` y pon ahí esa URL, completa y con `https://`.
3. **Deployments** → el último → **Redeploy**.

**Salió bien si**: tras el redespliegue la app sigue abriendo.

---

## Paso 9 · Instalarla en el teléfono

Mándales la URL a los siete por WhatsApp con estas instrucciones:

**En Android (Chrome):** abre el enlace → menú de los tres puntos → *Añadir a
pantalla de inicio*.

**En iPhone (Safari):** abre el enlace → el botón de compartir (el cuadrado con
la flecha) → *Añadir a pantalla de inicio*.

**Tiene que ser Safari en iPhone.** Desde Chrome en iOS no aparece la opción; es
cosa de Apple, no de la app.

**Salió bien si**: aparece un icono oscuro con la fachada del edificio, y al
tocarlo la app abre **sin la barra de direcciones del navegador**.

---

## Paso 10 · Comprobar que quedó bien

Desde tu computadora, con el proyecto delante:

```bash
# Ningún secreto en el JavaScript que descarga el navegador.
npm run build && npm run verificar-secretos

# Con la base caída, ¿la app dice algo o se queda en blanco?
node scripts/prueba-base-caida.mjs
```

Y a mano, en el teléfono:

- [ ] Elegir departamento y ver la cuota.
- [ ] Tocar «¿Cómo se calculó?» y que salgan las cinco secciones.
- [ ] Avisos → Administración → PIN → que entre.
- [ ] **Modo avión**: cerrar la app, activarlo, abrir la app. Tiene que abrir y
      salir una banda ámbar que dice «Sin conexión».

---

## Lo que hay que hacer cada mes

Nada de servidores. El día 25, quien administra:

1. Entra a la app → Avisos → Administración → PIN.
2. **Cerrar el mes** y sigue los siete pasos.
3. Al publicar, a los siete les aparece su cuota.

---

## Cuando rote el administrador

El PIN lo cambia el desarrollador en las variables de Vercel. **Es una decisión
del producto que no haya pantalla para eso** (`README` §7).

1. Vercel → Settings → Environment Variables → edita `ADMIN_PIN`.
2. Cambia también `ADMIN_SECRETO` por otro `openssl rand -base64 32`: así se
   caen las sesiones abiertas del administrador anterior, que es lo correcto.
3. Redeploy.

---

## Si algo sale mal

| Lo que ves | Qué es | Qué hacer |
|---|---|---|
| «Algo no está respondiendo» · log dice `Can't reach database server` | la URL es la **interna** de Railway, que Vercel no alcanza | usa `DATABASE_PUBLIC_URL` de Railway en las dos variables |
| «Algo no está respondiendo» · log dice `does not exist` o `P2021` | **las tablas no están creadas** | el build de Vercel NO las crea: corre `npx prisma migrate deploy` y la semilla desde tu máquina apuntando a Railway (paso 4) |
| El build falla en Vercel y en local no | falta una variable de entorno | compara las de Vercel con la tabla de claves de arriba |
| «Too many connections» | falta el pooler | añade `?pgbouncer=true&connection_limit=1` a `DATABASE_URL` |
| `migrate deploy` se queda colgado | `DIRECT_URL` apunta al pooler | `DIRECT_URL` va **sin** `pgbouncer` |
| El PIN correcto no entra | se agotaron los intentos de esa IP | son ocho cada quince minutos; espera |
| En iPhone no sale «Añadir a pantalla de inicio» | estás en Chrome | ábrelo en Safari |

---

## Lo que este documento no cubre

- **Dominio propio** (`edificio-salazar.pe` en vez de `algo.vercel.app`). Se hace
  en Vercel → Settings → Domains y hay que tocar el DNS del dominio. No hace
  falta para funcionar.
- **Probar las notificaciones push de verdad.** Están hechas y funcionan, pero
  necesitan HTTPS: solo se comprueban una vez desplegado. El primer día, activa
  los avisos desde «Mi departamento» en tu teléfono y publica un mes de prueba
  para verlo llegar. Sin las claves VAPID la app funciona igual, sin avisos.
- **Conectar a Bob con DeepSeek.** El camino está hecho; falta la clave. Con
  `BOB_MODO=determinista` funciona sin coste y sin clave.
