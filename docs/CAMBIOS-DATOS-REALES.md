# Cambios sobre el Excel real y las notificaciones

Registro de esta tanda de trabajo: qué se reconcilió contra el Excel real del
edificio, qué decisiones se tomaron, y qué quedó verificado y qué no. Sirve de
declaración del estado real (verificación adversarial, cierre de fase).

## De dónde salió cada decisión

Se leyó **el Excel interno completo** (`Admin_Edificio_…xlsx`, 8 hojas: cálculo
de mantenimiento mes a mes desde 2024, pago del mes, ajuste de agua, base de
datos de consumo, histórico, recibos, pagos). Es la fuente de la verdad.

### Reparto: siempre por porcentaje, nunca equitativo

El Excel tenía meses con reparto **equitativo** (la cuota de la bomba de agua,
S/ 182.90 a cada uno; el portón, S/ 300 entre seis). **Quien lleva las cuentas
confirmó que eso fue un error**: todo gasto se reparte siempre por el porcentaje
(flat) de cada departamento. Decisión:

- No existe la opción de reparto equitativo ni entre un subconjunto. Se quitó por
  completo (motor, esquema, UI). Si alguien pagó algo aparte, va como **crédito**
  a su cuota, que es lo que el propio Excel ya hacía.
- **El histórico no se toca y no aparece ninguna nota.** Los meses viejos quedan
  como están; la app no recalcula meses publicados ni muestra «antes era
  distinto». Nadie ve un mensaje que despierte dudas.

### La data vive en Railway, no en el seed

El seed de la app (`lib/semilla.ts`) es data de demo/prototipo, **no** la del
edificio. Los datos reales se **inyectan en Railway** y se editan desde el panel.
Por eso el trabajo fue hacer la app **100% editable**, no transcribir recibos:

- Se puede **agregar un concepto fijo nuevo** desde el paso 4 (nombre, marca de
  anual ÷12, con monto o «por confirmar»). El backend ya lo soportaba; faltaba la
  UI y pasar `anual` por el endpoint.
- Los montos, recibos, lecturas, gastos, créditos y pagos ya eran editables.

### Conceptos anuales (÷12) y el que faltaba

Los conceptos que el Excel divide entre 12 están bien marcados como `anual`:
mant. bomba (2500/12), mant. cisterna (600/12), cerco eléctrico (585/12), cambio
extintor (390/12) y **pozo a tierra** (1480/12, hoy «por confirmar»). Se detectó
que faltaba **«Limpieza» (~S/400/mes)** como concepto —el Excel tiene la limpieza
(servicio) y los insumos como dos líneas—; se agrega desde el panel en Railway.

### Pozo a tierra

Queda **«por confirmar»** (monto `null`, editable): hoy no hay monto y el
proveedor de 2025 era otro. La app lo muestra con su etiqueta y suma 0 hasta que
se le ponga cifra.

## Lo que se construyó y verificó

Todo con `tsc` limpio, tokens sin huérfanos, y prueba negativa donde aplica.

| Cambio | Verificación |
|---|---|
| **Q1** · el lavado que no cupo se recupera al corregir, con el m³ congelado | Integración + prueba negativa (reintroducir el defecto pone el test en rojo) |
| **Q2** · el aviso de corrección usa la instantánea, y la instantánea se mantiene | Integración, con el caso de dos correcciones seguidas |
| **Q3** · candado del flat: la base y el código coinciden | Integración + prueba negativa (un flat distinto lo detecta) |
| **G3** · pagos con monto real y saldo a favor que arrastra | Unit + integración (a favor, de menos, sin pagar, arrastre); UI con confirmar-otro-monto y balance en Mi Departamento |
| **Años** · el año se ve donde puede confundir; eje con año en cada salto | Unit del helper `cortosConAnio` |
| **Push** · avisos del navegador y la PWA | Integración (no-op sin claves, envío con claves, limpieza de suscripciones caídas). **La entrega real solo se prueba desplegada.** |
| **WhatsApp** · popover «avísales a los demás» al publicar/corregir | e2e (la pantalla Publicado renderiza el popover) |
| **Editabilidad** · agregar concepto fijo | Integración (crear «Limpieza» 400 sube el mantenimiento 400; un anual entra con su marca) |

## Lo que **no** se puede verificar aquí

- **La entrega de push de verdad.** Necesita HTTPS, claves VAPID reales y un
  servicio de push del navegador. Aquí se probó la lógica del servidor con
  `web-push` simulado. En despliegue: generar las claves con
  `npx web-push generate-vapid-keys`, ponerlas en Vercel (la privada **sin**
  `NEXT_PUBLIC_`), y probar en un teléfono. Sin claves, no hay push y el aviso de
  WhatsApp cubre el caso.
- **El selector de departamento** guarda el elegido en una **cookie de
  dispositivo** (no `localStorage`): el servidor la lee y ya muestra el
  departamento correcto en la primera carga, sin parpadeo. Persiste en el
  dispositivo y se cambia en Mi Departamento.

## Bajo qué condición esto estaría equivocado

- Si un mes futuro necesitara de verdad un reparto **no** proporcional, el reparto
  por flat daría cuotas distintas de lo esperado —pero el cuadre saldría verde
  igual—. La señal temprana es comparar cuota por cuota contra el papel del mes,
  no solo el total. La decisión tomada es que eso **no** ocurre: todo por flat.
- El balance por departamento cuenta un mes publicado sin pago confirmado como
  cuota en contra. Si el seed/Railway no tiene los pagos cargados, un depto puede
  aparecer «te toca poner» de más. Es la verdad del dato, no un error del cálculo:
  se corrige cargando los pagos reales.

## Corrección del flat del 202 y del 502 · la escritura manda

**Qué cambió.** El porcentaje de metraje del 202 pasó de `20.12` a `20.11`, y el
del 502 de `20.22` a `20.23`. Los dos juntos siguen sumando 40.34, así que el
total de los siete sigue siendo exactamente 100.00 (hay un test que lo exige).

**Por qué.** El Excel que lleva la administración —y la escritura de la que sale—
usa 20.11 y 20.23. El mockup del handoff arrastraba el mismo dato transcrito con
un redondeo distinto (20.12 / 20.22), y la app lo había copiado de ahí. Como la
escritura es la fuente por encima del mockup, se corrigió **en las dos fuentes de
datos** (`lib/calculo/constantes.ts` y `mockup/.../datos-edificio.js`) y se
regeneró el golden con `node scripts/generar-golden.mjs`. Así la fidelidad al
céntimo entre la app y el motor del mockup se mantiene, ahora los dos con el
valor correcto.

**Cuánta plata mueve.** Un céntimo de porcentaje sobre una base de ~S/ 3 000 son
**~S/ 0.30 al mes**, y se compensan entre esos dos departamentos: el 502 paga
S/ 0.30 más y el 202, S/ 0.30 menos. Verificado rederivando sobre junio de 2026:
el mantenimiento del 502 pasa de 605.18 a 605.48 y su cuota total de 675.43 a
675.73.

**Un efecto secundario que valía la pena.** El test que probaba que
`round(base × flat) / 100` **no** es lo mismo que `round2(base × flat / 100)`
usaba justo el par (2925, 20.22), uno de los pocos donde las dos formas difieren.
Con el flat corregido las dos formas coincidían, así que el test habría seguido
en verde **sin probar nada**. Se cambió a (2850, 20.23), que sí difiere
(576.56 vs 576.55), para que siga discriminando con un flat vigente.
