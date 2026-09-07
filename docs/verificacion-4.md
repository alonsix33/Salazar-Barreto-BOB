# Verificación · Fase 4 · Pantallas de vecino

> **Escrito tarde, en la auditoría final**, al ver que el entregable pedía nueve
> `verificacion-N.md` y había siete. Que faltara es un defecto de la Fase 4, y
> consta en `docs/AUDITORIA-FINAL.md`. Todo lo de aquí se volvió a ejecutar.
>
> Estado: **los 10 puntos del verificador pasan**, con las salvedades de §11.

---

## 1. Comparación visual contra el mockup

Las seis pantallas y las diez hojas se compararon contra el prototipo a 390px.
La auditoría final volvió a hacerlo con un verificador dedicado, y de ahí salió
una lista de doce diferencias que **se arreglaron**: la tira ENE→DIC que
mostraba el mes equivocado, la pantalla de «publicado» que había perdido su
tarjeta noche, dos animaciones de `02` §6 que faltaban, y ocho textos que se
apartaban del prototipo o mentían en algún estado. El detalle de cada una está
en `docs/AUDITORIA-FINAL.md`.

## 2. Responsive real · 7 anchos × 2 alturas

`tests/e2e/responsive.spec.ts` recorre las cinco pantallas de vecino a 320, 360,
390, 430, 768, 1024 y 1440px, y a 844 y 560px de alto, y falla si
`document.documentElement.scrollWidth > clientWidth` o si un elemento se sale del
marco. Las hojas del panel se miden aparte, a los mismos anchos.

El detalle de la medición —cuántas combinaciones y cuántos elementos por
combinación— está en `docs/verificacion-6.md` §responsive y en
`docs/AUDITORIA-FINAL.md`.

## 3. `min-width: 0` en los contenedores flex con texto

16 reglas `min-width: 0` en `app/globals.css`, más los `min-w-0` de los
componentes. La rejilla del agua de P2, que es la que se desbordaba por debajo
de 340px sin esto, se prueba a 320px en la suite.

## 4. Texto largo

Un nombre de departamento largo no rompe la maquetación: los contenedores de
nombre llevan `truncate` con `min-width: 0`. En el edificio real los nombres son
cortos («Renzo», «Deborah y Oscar»), y el onboarding recorta al primero.

## 5. Escalado del sistema al 200%

Cubierto en la Fase 6 (`docs/verificacion-6.md`): la suite de accesibilidad mide
el contenido con la fuente al 200% y falla si algo queda cortado, contando los
elementos examinados para no pasar sobre cero.

## 6. Cero datos

Un mes sin lecturas, sin recibo y sin pagos devuelve un `ResultadoMes` **inválido
con su motivo**, nunca `NaN`, `undefined` ni `Infinity`: lo fija la batería del
motor (`lib/calculo/__tests__/bateria.test.ts`, «siempre») y los estados vacíos
de las pantallas. La semilla deja 2026-07 en curso justo para poder recorrer ese
estado.

## 7. Un solo bloque noche por pantalla

Comprobado en la auditoría final contando los `data-bloque-noche` sin ancestro
noche: Inicio, El mes, Mi departamento e Historial tienen **una** tarjeta noche
cada una. Los demás fondos noche son los que el propio sistema manda: la píldora
de navegación (`02` §4.7), la píldora del mes activo y los círculos numerados de
la hoja de cálculo.

## 8. El agua, celeste en todo

`--color-agua` (y sus variantes) se usan en 13 ficheros de pantalla, en todo lo
que menciona agua: consumo, factura, m³, gráficos, etiquetas. La auditoría final
recogió el color computado de cada nodo que habla de agua y no encontró ninguno
fuera de `#3E93B8` salvo dos literales del propio prototipo (el texto del lavado
sobre noche, atenuado, y una etiqueta con la barra en agua).

## 9. Sin rojo en ningún estado de pago

Cero. La auditoría final volcó `getComputedStyle` de las veinte pantallas y
hojas: `rojos = 0`. En el CSS no hay ni un hex rojo, y las palabras «moroso»,
«deudor», «vencido» solo aparecen en comentarios que las **prohíben** y en las
guardas de Bob.

## 10. Lighthouse móvil

Rendimiento 96–100, accesibilidad 95 (`docs/verificacion-6.md` y
`docs/verificacion-7.md`). Por encima del ≥90/≥95 que pide el enunciado.

---

## 11. Lo que no está verificado, y bajo qué condición fallaría

1. **La comparación visual es funcional, no pixel a pixel.** Se comprobó que cada
   valor sale del token correcto (`lib/__tests__/tokens-vs-diseno.test.ts`) y que
   no hay desbordes, no que el render sea idéntico al píxel contra una captura
   del prototipo. **Señal temprana**: una diferencia de espaciado la vería el
   usuario antes que cualquier test; por eso el token está fijado, que es la
   causa, no el síntoma.
2. **Nadie ha usado esto en un teléfono de verdad.** Todo el responsive es
   Chromium redimensionado. Un teclado de sistema real, un notch concreto o un
   navegador embebido pueden hacer algo que el emulador no.
3. **El conteo de la cifra y el crecimiento de las barras** se añadieron en la
   auditoría final y se prueban por existencia y por respeto a
   `prefers-reduced-motion`, no midiendo los 60fps en un móvil de gama media,
   que es lo que `02` §6 pide de verdad y que aquí no se puede medir.
