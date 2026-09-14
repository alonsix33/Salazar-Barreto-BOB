# 05 · Bob · el asistente

---

## 1. Qué es Bob

Bob lee todo el historial del edificio y lo explica en lenguaje normal. Nada más.

**No es un chatbot de soporte, ni un asistente genérico, ni una mascota.** Es la
persona que se leyó los 14 meses de recibos y te puede decir por qué tu cuota subió.

El nombre corto y humano fue una decisión: "el asistente del edificio" era frío y
"Vecina" fingía ser una persona. Bob no finge nada.

---

## 2. Lo que Bob NO puede hacer

Esto es un contrato, no una recomendación. Romperlo destruye la confianza que la app
existe para construir.

| Prohibido | Por qué |
|---|---|
| **Ver la cuenta bancaria** | No tiene acceso. No puede detectar depósitos ni decir *"vi un depósito de S/ 343.48 el 24 de julio"*. Eso lo verifica una persona. |
| **Confirmar un pago** | Solo el administrador, contra el estado de cuenta. |
| **Rellenar campos solo** | Puede sugerir. El administrador acepta o rechaza. |
| **Modificar un mes publicado** | Solo una persona, y queda registrado. |
| **Juzgar a un vecino** | Nunca "el 501 siempre paga tarde". Datos, no caracteres. |
| **Inventar un número** | Si no tiene el dato, lo dice: *"eso todavía no está registrado"*. |
| **Dar porcentajes de confianza** | O está seguro, o pide confirmación. Binario. |

---

## 3. Cómo habla

| Regla | Detalle |
|---|---|
| **Dos líneas** | Si necesita más, el momento está mal diseñado. |
| **Siempre con el dato** | No *"tu consumo subió"* sino *"subiste de 6.20 a 8.42 m³"*. |
| **Con dónde verificarlo** | Cada respuesta enlaza a la pantalla que lo demuestra. |
| **Sin hablar de sí mismo** | Nunca *"como asistente, no puedo…"*. Dice qué sí puede. |
| **Reporta lo bueno también** | No solo pendientes. *"Junio va bien: 5 de 7 ya registrados."* |
| **Español peruano llano** | Sin jerga técnica, sin anglicismos. |

### Ejemplos reales del prototipo

> *"El lavado del 401 son 1.50 m³ al mes que salen del caño común. No se cobran por
> fuera de la factura: se restan del área común —que este mes queda en 0.30 m³— y se
> le suman al 401, así que el total del edificio sigue siendo exactamente lo que
> factura SEDAPAL."*

> *"81 m³ está en línea con los últimos meses: junio fueron 78 y mayo 78."*

> *"Tu consumo está estable desde marzo."*

### Un caso que hubo que corregir

Bob decía: *"Los seis meses anteriores los registraste antes del día 10. Este es el
primero que queda abierto."*

Nadie entendía qué significaba. Se reescribió para decir exactamente qué falta y qué
hacer. **La lección: si una frase necesita releerse, se cambia.**

---

## 4. Dónde aparece

| Lugar | Forma |
|---|---|
| **Botón de la nav** | Círculo terracota de 62px a la derecha de la píldora. Abre su hoja. |
| **Dentro del cierre del mes** | Tarjeta ámbar suave con avatar de 24px. Contexto sobre el dato que se acaba de escribir. |
| **Bajo un gráfico** | Una línea que interpreta lo que se ve. |
| **Propuesta de corrección** | Tarjeta con dos botones: aceptar o mantener. |

---

## 5. La hoja de conversación

**Al abrir Bob, la conversación está ahí mismo.** No hay pantalla intermedia ni un
segundo paso. Se corrigió durante el diseño porque interrumpía el flujo.

```
┌─────────────────────────────────────┐
│ (avatar)  Bob                    ✕  │
│           lee todo el historial     │
├─────────────────────────────────────┤
│                                     │
│   [ conversación, scroll ]          │
│                                     │
├─────────────────────────────────────┤
│  [chip] [chip] [chip]               │  ← preguntas sugeridas
│  [ escribe tu pregunta      ]  [→]  │
└─────────────────────────────────────┘
```

- Cabecera: avatar 42px, nombre en Syne 700 17px, subtítulo gris, cerrar
- Conversación: `flex: 1; overflow-y: auto`, `padding: 18px 22px 8px`
- Campo: 50px de alto, radio 999px, blanco con borde sutil; botón terracota de 50px
- Enter envía

### Preguntas sugeridas

Chips sobre el campo. Cambian según el contexto:

- *¿Cuánto debo este mes?*
- *¿Por qué subió el agua?*
- *¿Quién falta por pagar?*
- *¿Qué es el lavado del 401?*

---

## 6. Implementación

En el prototipo las respuestas son **deterministas**: funciones escritas a mano que
leen `calcularMes()` y devuelven texto. No hay modelo detrás.

Para producción hay dos caminos:

### Opción A · Determinista (recomendada para empezar)

Un catálogo de intenciones con respuestas generadas desde los datos reales. Lo que ya
está en el prototipo, ampliado.

**A favor:** nunca inventa un número, coste cero, respuesta instantánea, auditable.
**En contra:** solo responde lo previsto.

Para siete personas con preguntas repetitivas sobre su cuota, esto cubre la gran
mayoría de los casos.

### Opción B · Modelo de lenguaje con herramientas

El modelo **no ve los números directamente**: llama a funciones (`calcularMes`,
`serieSaldo`, `consumoDe`) y redacta con lo que devuelven.

**Reglas no negociables si se toma este camino:**

1. **Nunca calcular en el modelo.** Todo número viene de una llamada a función.
   Si no hay función, no hay número.
2. **Sin acceso de escritura.** Bob lee. Las escrituras las hace una persona.
3. **Prompt del sistema con las prohibiciones de §2 explícitas**, incluida la del
   acceso bancario.
4. **Límite de longitud duro.** Dos líneas.
5. **Registrar cada respuesta** para poder revisar si dijo algo mal.

### Lo que no se hace, en cualquiera de los dos casos

- Texto que aparece letra por letra fingiendo que piensa
- Chispas ✨, gradientes morados, o iconografía de "IA"
- Burbuja flotante en la esquina
- Disculpas o meta-comentarios sobre sus capacidades
- "Insights" sin acción posible (*"tu consumo es interesante"*)

**Revisado tras el lanzamiento:** "puntos pulsando" salió de esta lista a
pedido explícito, después de probar la app de verdad. La regla seguía siendo
correcta contra su propio riesgo —fingir contenido que no existe—, pero un
silencio quieto mientras se espera la respuesta se sentía roto, no discreto.
Los tres puntos que laten mientras se espera son el gesto de "alguien te está
respondiendo" de cualquier app de mensajería —no afirman nada sobre lo que
Bob está pensando—, y la línea de estado que los acompaña ahora varía en vez
de repetir siempre la misma frase. Lo que sigue prohibido, sin excepción, es
el texto de la respuesta apareciendo letra por letra: la guarda que impide que
Bob invente una cifra (`lib/bob/guardas.ts`) exige ver la respuesta completa
antes de decidir si se publica, así que nunca hay nada verificado que mostrar
de a poco.
