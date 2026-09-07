# Verificación 2 · Tokens de diseño · cero valores huérfanos

Estado al cerrar la fase: **verde**, con dos discrepancias declaradas entre el
documento de diseño y el prototipo (§4).

```
node scripts/verificar-tokens.mjs   ✓ cero valores huérfanos · 33 archivos, 3 900 líneas
npx vitest run                      245 tests en verde
npx tsc --noEmit                    sin errores
```

---

## 1. El verificador

`scripts/verificar-tokens.mjs` recorre `app/`, `components/`, `lib/`, `scripts/`,
`tests/` y `prisma/`, y falla con código distinto de cero si encuentra:

| Regla | Qué busca |
|---|---|
| `hex` | Un color hexadecimal en un `.ts` o `.tsx` |
| `rgb` | Un `rgb(` o `rgba(` en un `.ts` o `.tsx` |
| `px-en-style` | Un `px` literal dentro de una prop `style` |
| `px-en-clase-arbitraria` | Un `px` literal en una clase arbitraria de Tailwind, `w-[132px]` |
| `paleta-tailwind` | Un color por defecto de Tailwind, `text-gray-500`, `bg-slate-*`… |
| `fuente-ajena` | Las palabras `Inter`, `Roboto`, `Arial`, `Helvetica` |
| `font-family-suelta` | Un `font-family` que no venga de `var(--font-…)` |

Está en `npm run verify` y en el pipeline de CI.

### La lista blanca es explícita y comentada

Tres entradas, cada una con su motivo en el propio script: las coordenadas de un
SVG (`viewBox`, `stroke-width`), las tres variables de dispositivo de `02` §7
(`--top`, `--bot`, `--rad`), y los puntos de corte de `@media`, que son parte de
la definición responsive y no un valor de componente.

### Una sola excepción por archivo, y está atada

`lib/tema.ts` guarda el color de tema de la PWA y el de los iconos, porque los
consume el **sistema operativo** y no el navegador: no pueden salir de una
variable CSS. No es una excepción de verdad, porque `lib/__tests__/tema.test.ts`
comprueba que cada valor de ahí es idéntico, letra por letra, al token
correspondiente de `globals.css`. Si alguien cambia el token y olvida el archivo,
el test se pone rojo.

El propio verificador falla con código 2 si `lib/tema.ts` o su test dejan de
existir: **un chequeo con una excepción muerta miente sobre su alcance.**

### El verificador encontró un valor huérfano en su primera ejecución

El `themeColor: '#F7F4EE'` de `app/layout.tsx`. Que la primera corrida encontrara
algo real es la mejor señal de que el chequeo funciona.

---

## 2. Prueba negativa · las siete reglas, en rojo

Un chequeo que nunca se vio fallar es una decoración.
`lib/__tests__/verificar-tokens.test.ts` le mete al script, una por una, cada
clase de valor huérfano que dice atrapar, sobre un árbol temporal fuera del repo,
y comprueba que sale en rojo:

```
✓ atrapa un valor huérfano de tipo "hex"
✓ atrapa un valor huérfano de tipo "rgb"
✓ atrapa un valor huérfano de tipo "px-en-style"
✓ atrapa un valor huérfano de tipo "px-en-clase-arbitraria"
✓ atrapa un valor huérfano de tipo "paleta-tailwind"
✓ atrapa un valor huérfano de tipo "fuente-ajena"
✓ atrapa un valor huérfano de tipo "font-family-suelta"
✓ un árbol limpio sale en verde y dice cuántos archivos revisó
✓ no se queda callado si no revisó nada: sale con código 2
✓ el repo de verdad está limpio
```

Los defectos de prueba se arman por trozos (`'#' + 'C9773A'`) a propósito. Si
estuvieran escritos enteros, ese archivo sería a su vez un valor huérfano y el
script se marcaría a sí mismo; y excluirlo del chequeo habría sido peor, porque
un chequeo con un agujero es un chequeo que miente sobre su alcance.

---

## 3. Los tokens contra el documento, no contra mi memoria

`lib/__tests__/tokens-vs-diseno.test.ts` **lee
`mockup/02-sistema-de-diseno.md`** y comprueba token por token. No es una lista
transcrita: es el documento parseado. Si el documento cambia y los tokens no,
esto se pone rojo.

| Comprobación | Resultado |
|---|---|
| La tabla "Paleta" tiene exactamente 18 filas | ✅ |
| Los 18 colores están definidos en `@theme` | ✅ 18/18 |
| Los 9 valores funcionales de fondos suaves y capas sobre noche | ✅ 9/9 |
| La tabla de radios tiene 9 filas con 10 valores | ✅ |
| Los 10 radios existen como token | ✅ 10/10 |
| La sombra del marco es `0 24px 60px rgba(14,14,14,.13)` | ✅ |
| La sombra de la hoja es `0 -8px 40px rgba(14,14,14,.2)` | ✅ |
| Hay exactamente 3 familias tipográficas y son Syne, DM Sans y JetBrains Mono | ✅ |
| La etiqueta de sección es mono 10px, `.16em`, mayúsculas | ✅ |
| No existe ningún token con nombre de rojo | ✅ |
| El agua tiene su token y su versión sobre noche | ✅ |
| El degradado terracota está definido **una sola vez** | ✅ |

**Nota sobre el conteo:** de los 18 colores de la paleta, 16 vienen en hex y 2
(`linea` y `borde-tarjeta`) en color funcional. El "neutro suave" de la tabla de
fondos comparte valor con `borde-tarjeta`, así que los valores funcionales
distintos fuera de la paleta son 9, no 10. Está anotado en el test para que nadie
lo lea como un token que falta.

---

## 4. Las dos discrepancias entre el documento y el prototipo

Se declaran en vez de resolverlas en silencio.

### 4.1 La "versión clara" de los estados sobre noche

`02` §4.2 dice que sobre fondo noche el texto de la píldora "usa la versión
clara", y **no da el valor** para verde ni para ámbar. El prototipo usa `#7BD3A0`
y `#E8A94A`. Se toman esos, como tokens `--color-verde-claro` y
`--color-ambar-claro`, documentados como lo que son.

Criterio: entre inventar un valor y tomar el del prototipo, gana el prototipo,
que es la referencia visual literal y lo que el cliente vio en pantalla.

### 4.2 La opacidad del fondo de la píldora sobre noche

`02` §4.2 dice que sobre noche el fondo sube a `.18`. El prototipo usa `.14`
para el verde, `.15` para el ámbar y `.15` para el agua. Se toman los del
prototipo, por el mismo criterio, y se anota aquí que difieren del documento. La
diferencia es invisible a ojo; lo que no puede pasar es que la contradicción
quede escondida.

---

## 5. Las comprobaciones a mano que pide el prompt

| Pregunta | Respuesta |
|---|---|
| ¿Están los 18 colores de `02` §1? | Sí, comprobado contra el documento parseado, no contra una lista transcrita. |
| ¿Hay algún sitio donde el agua no sea `--color-agua`? | No hay ninguno **todavía**: al cerrar esta fase aún no hay pantallas. La comprobación de verdad es la de la Fase 4, que grepea las pantallas ya escritas. Aquí queda garantizado que existe un solo token de agua y su versión sobre noche, y que no hay ningún otro celeste en la paleta. |
| ¿Hay rojo en algún estado de pago? | No. `PildoraEstado` no acepta un color por prop: acepta el estado (`al-dia`, `sin-registrar`, `en-verificacion`) y mapea a verde, ámbar y neutro. No existe ningún token rojo en `@theme`, y hay un test que lo comprueba. |
| ¿Hay más de un bloque noche por pantalla? | Sin pantallas todavía. `TarjetaNoche` marca su nodo con `data-bloque-noche` precisamente para que la Fase 4 pueda contarlos con un test de Playwright, en vez de a ojo. |

---

## 6. Las primitivas

`components/ui/`: `Etiqueta`, `Cifra`, `PildoraEstado`, `TarjetaNoche`,
`TarjetaBlanca`, `FilaDivisoria`, `Boton`, `BotonSecundario`.

Ninguna acepta un color arbitrario por prop. Dos decisiones que conviene señalar:

- **`Etiqueta` es un componente, no una clase.** `02` §2 avisa de que la etiqueta
  mono de 10px con `letter-spacing: .16em` es el sello visual de la app y de que
  no hay que sustituirla por un `<h3>` normal. Como componente, no hay nada que
  recordar.
- **`Boton` obliga por tipo a explicar el bloqueo.** `04` §5 pide que el botón de
  avanzar diga qué falta en vez de ponerse gris sin explicación. El tipo del
  componente hace `motivoBloqueo` obligatorio cuando `deshabilitado` está puesto:
  un botón bloqueado y mudo **no compila**.

---

## 7. Bajo qué condición esto estaría equivocado

- **Si un valor entrara por una vía que el script no revisa.** Hoy revisa seis
  carpetas y cuatro extensiones, e imprime cuántos archivos y líneas miró en cada
  corrida, precisamente para que se note si su alcance se encoge. La señal
  temprana es que ese número baje sin motivo.
- **Si un token existiera pero nadie lo usara.** El script comprueba que no haya
  valores sueltos; no comprueba que los tokens se usen donde toca. Eso solo se
  puede verificar con las pantallas delante, y es la comparación visual de la
  Fase 4.
- **Si Tailwind no generase la utilidad de un token.** Un `bg-terra-suave` mal
  escrito no es un valor huérfano: simplemente no pinta nada. Lo atrapa la
  comparación visual de la Fase 4, no este script.
