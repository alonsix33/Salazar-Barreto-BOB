/**
 * TODOS los textos de pantalla, transcritos literalmente de
 * `mockup/03-pantallas.md`, `mockup/04-cierre-del-mes.md` y del prototipo.
 *
 * Están aquí y no repartidos por los componentes para que se vea que son
 * **contenido, no decoración**. Se escribieron y reescribieron para el tono
 * "vecino, no cobrador": no se mejoran, no se acortan, no se traducen.
 *
 * Regla dura: **ningún valor interpolado se escribe fijo.** Los copys que
 * llevan un número son funciones que reciben el valor del cálculo. El caso
 * concreto es la línea del lavado: dice "Incluye 1.50 m³" y ese 1.50 viene del
 * motor. Este bug apareció dos veces durante el diseño.
 */

import { fmt } from './calculo/redondeo'
import type { MotivoLectura } from './calculo/correccion'
import type { EstadoCuota } from './estados'

/**
 * Los múltiplos en palabras, como los escribe `04`: *«cuatro veces tu promedio»*,
 * no *«4 veces»*. Fuera del rango vuelve a la cifra: *«14 veces»* se lee bien y
 * ninguna lista de palabras cubre un consumo que se disparó.
 */
const VECES: Record<number, string> = {
  // `muyAlto` exige pasar **estrictamente** del doble, así que "más" es exacto.
  2: 'más del doble de tu promedio',
  3: 'tres veces tu promedio',
  4: 'cuatro veces tu promedio',
  5: 'cinco veces tu promedio',
  6: 'seis veces tu promedio',
  7: 'siete veces tu promedio',
  8: 'ocho veces tu promedio',
  9: 'nueve veces tu promedio',
  10: 'diez veces tu promedio',
}

export const COPYS = {
  app: {
    nombre: 'Edificio Jr. Enrique Salazar Barreto',
    nombreCorto: 'Salazar Barreto',
    descripcion:
      'Las cuentas del edificio, abiertas. Cada cuota se abre y muestra cómo se calculó.',
    direccion: 'Jr. Enrique Salazar Barreto',
  },

  /** `01` §7 · nunca "deudor", "moroso" ni "vencido". */
  estados: {
    'al-dia': 'Al día',
    'sin-registrar': 'Sin registrar',
    'en-verificacion': 'En verificación',
  } satisfies Record<EstadoCuota, string>,

  // ── P0 · Elegir departamento ───────────────────────────────────────────
  onboarding: {
    marca: 'Jr. Enrique Salazar Barreto',
    titulo: '¿Cuál es tu departamento?',
    subtitulo: 'Así Inicio te muestra lo tuyo primero.',
    entrar: 'Entrar',
  },

  // ── P1 · Inicio ────────────────────────────────────────────────────────
  inicio: {
    saludo: (dpto: string) => `Hola, ${dpto}`,
    tuCuota: (mes: string) => `Tu cuota de ${mes}`,
    comoSeCalculo: '¿Cómo se calculó?',
    yaPague: 'Ya pagué',
    mantenimiento: 'Mantenimiento',
    consumoAgua: (m3: number) => `Consumo de agua · ${fmt(m3)} m³`,
    /** El 1.50 viene del cálculo. Si el admin lo cambia a 3, la frase dice 3.00. */
    incluyeLavado: (m3: number) =>
      `Incluye ${fmt(m3)} m³ del lavado de vehículo, que salen del caño común.`,
    los7: 'Los 7 este mes',
    grupoAlDia: 'Al día',
    grupoAvisaron: 'Avisaron, falta confirmar',
    grupoSinAviso: 'Sin aviso todavía',
    leyendaAlDia: 'Al día',
    leyendaPorConfirmar: 'Por confirmar',
    leyendaSinAviso: 'Sin aviso',
    tuDepartamento: 'Tu departamento',
    enQueSeGasto: 'En qué se gastó',
    facturaAguaCon: (m3: number) => `Factura de agua · ${m3} m³`,
    restoGastos: (n: number) => `+ ${n} gastos más · total del mes`,
    laCuenta: 'La cuenta',
    recibido: 'Recibido',
    gastado: 'Gastado',
    resumenPagos: (confirmados: number, avisados: number) =>
      avisados
        ? `${confirmados} confirmados · ${avisados} por confirmar`
        : `${confirmados} / 7`,
    notaSaldo: (delta: number) =>
      delta < 0
        ? `acumulado de la cuenta conjunta · este mes bajó S/ ${fmt(Math.abs(delta))}`
        : `acumulado de la cuenta conjunta · este mes subió S/ ${fmt(delta)}`,
    sparklineCorta: 'La curva aparece con el tercer mes',
    detalleSinRegistrar: 'Aún no hay un pago asociado a este mes.',
    detalleEnVerificacion: (fecha: string) =>
      `Avisaste el ${fecha}. Falta que lo confirmen contra el estado de cuenta.`,
    detalleAlDia: (fecha: string, op: string) => `Pagado el ${fecha} · op. ${op}`,
  },

  // ── P2 · El mes ────────────────────────────────────────────────────────
  mes: {
    titulo: 'El mes',
    costoTotal: 'Costó mantener el edificio',
    comparacion: (diferencia: number) =>
      diferencia >= 0
        ? `S/ ${fmt(diferencia)} más que el mes pasado`
        : `S/ ${fmt(Math.abs(diferencia))} menos que el mes pasado`,
    sinComparacion: 'repartido entre los siete según metraje',
    consumoPorDpto: 'Consumo de agua por dpto · m³',
    aguaSedapal: 'Agua SEDAPAL',
    m3DelEdificio: 'm³ del edificio',
    facturaAgua: 'Factura de agua',
    notaComun: (m3: number) => `${fmt(m3)} m³ del área común`,
    notaComunAjustado: 'los medidores midieron de más',
    verCalculo: 'Ver el cálculo completo →',
    gastosDe: (mes: string) => `Gastos de ${mes}`,
    anual: 'ANUAL ÷ 12',
    porConfirmar: 'por confirmar',
    total: 'Total',
    las7Cuotas: 'Las 7 cuotas',
    desglose: (mantenimiento: number, agua: number) =>
      `mant. ${fmt(mantenimiento)} + agua ${fmt(agua)}`,
    pagosRecibidos: 'Pagos recibidos',
    sinPagos: 'Todavía no hay pagos confirmados de este mes.',
    detallePago: (fecha: string, op: string) => `${fecha} · op. ${op}`,
    /** `01` §3.4: en la interfaz esto nunca se llama "ajustado" ni "Ruta A/B". */
    explicaNormalConLavado: (medidores: number, sedapal: number, lavado: number, comun: number) =>
      `Los medidores sumaron ${fmt(medidores)} m³ y SEDAPAL facturó ${sedapal}. De la diferencia, ${fmt(lavado)} m³ son el lavado del 401; los ${fmt(comun)} m³ restantes son área común y se reparten entre los siete.`,
    explicaNormalSinLavado: (medidores: number, sedapal: number, comun: number) =>
      `Los medidores sumaron ${fmt(medidores)} m³ y SEDAPAL facturó ${sedapal}. La diferencia, ${fmt(comun)} m³, se cobra como área común.`,
    explicaAjustado: (medidores: number, sedapal: number) =>
      `Los medidores sumaron ${fmt(medidores)} m³ y SEDAPAL facturó ${sedapal}. Como no se puede cobrar más de lo que llegó en el recibo, a cada uno se le descontó la misma proporción.`,
  },

  // ── P3 · Mi departamento ───────────────────────────────────────────────
  miDpto: {
    cabecera: (nombre: string, flat: number) => `${nombre} · Flat ${flat}%`,
    titulo: (dpto: string) => `Depa ${dpto}`,
    cambiar: 'Cambiar',
    // El balance que arrastra. En positivo y en suave; nada de «deuda».
    aFavor: 'Tienes a favor',
    leFalta: 'Te toca poner',
    comoPagar: 'Cómo pagar',
    yaPague: 'Ya pagué',
    lavado: 'Lavado de vehículo',
    explicaLavado: (m3: number) =>
      `El agua sale del caño común, así que esos ${fmt(m3)} m³ se restan del área común y se suman a los tuyos. No es un cobro aparte: el total sigue siendo lo que factura SEDAPAL.`,
    tuHistoria: 'Tu historia en el edificio',
    historialPagos: 'Historial de pagos',
    resumenAnual: (anio: number, alDia: number, meses: number, enVerificacion: number) =>
      enVerificacion
        ? `pagado en ${anio} · ${alDia} al día, ${enVerificacion} en verificación`
        : `pagado en ${anio} · ${alDia} de ${meses} meses al día`,
    tuConsumo: 'Tu consumo de agua',
    notaConsumo: (mes: string, promedio: number) =>
      `en ${mes} · tu promedio del año es ${fmt(promedio)}`,
    administrar: 'Administrar el edificio',
    ejeInicio: 'ENE',
    ejeFin: 'DIC',
  },

  // ── P4 · Historial ─────────────────────────────────────────────────────
  historial: {
    titulo: 'Historial',
    subtitulo: 'Desde que los propietarios tomaron la administración.',
    laCuenta: 'La cuenta',
    consumoEdificio: 'Consumo de agua del edificio · m³',
    mesAMes: 'Mes a mes',
    estadoMes: (alDia: number) => `${alDia} de 7 al día`,
  },

  // ── P5 · Avisos ────────────────────────────────────────────────────────
  avisos: {
    titulo: 'Avisos',
    subtitulo: 'Todo lo que se movió en el edificio. Los siete ven lo mismo.',
    marcarLeido: 'Marcar todo leído',
    hoy: 'Hoy',
    estaSemana: 'Esta semana',
    antes: 'Antes',
    vacio: 'Todavía no hay avisos.',
  },

  /**
   * Cuando algo no se pudo traer.
   *
   * *Cargando*, *error* y *vacío* son **tres cosas distintas** y se dicen
   * distinto. Dos hojas del panel las confundían: al agotarse el reintento,
   * `isLoading` vuelve a `false` y `data` sigue sin llegar, así que la guarda
   * `isLoading || !data` caía siempre en la rama de carga y la hoja se quedaba
   * diciendo «Cargando…» para siempre. Con el PIN caducado o un 500, girando y
   * sin una palabra.
   */
  error: {
    /**
     * La pantalla de error, cuando algo se cae por debajo —la base, sobre todo—.
     *
     * Dice **qué pasó, qué no pasó, y qué hacer**. Lo segundo es lo que calma:
     * quien administra acaba de teclear siete lecturas y lo primero que piensa
     * es si las ha perdido. Y no se pide disculpas ni se echa la culpa a nadie.
     */
    pantallaTitulo: 'Algo no está respondiendo',
    pantallaTexto:
      'La app no pudo traer los datos del edificio. No se ha perdido nada: todo lo que estaba guardado sigue guardado.',
    pantallaQueHacer: 'Vuelve a intentarlo en un momento. Si sigue igual, avisa a quien administra.',
    reintentarPantalla: 'Volver a intentarlo',
    volverAInicio: 'Ir a Inicio',
    noEncontradoTitulo: 'Esta página no existe',
    noEncontradoTexto: 'Puede que el enlace esté viejo o que hayas escrito la dirección a mano.',
    noSePudo: 'No se pudo abrir esto ahora.',
    reintentar: 'Volver a intentarlo',
    sesionCaducada: 'La sesión de administración caducó. Vuelve a entrar con el PIN.',
    lecturasDelMes: (mes: string) => `No se pudieron traer las lecturas de ${mes}.`,
  },

  /**
   * Lo que oye un lector de pantalla cuando **cambia el estado de un pago**.
   *
   * `02` §8 lo pide explícitamente y era lo que faltaba: la píldora cambia de
   * color y de texto, pero quien no la ve no se entera de que su mes pasó a otro
   * estado. Se dice qué pasó y qué significa, no solo la etiqueta nueva.
   */
  anuncios: {
    pagoAvisado: (mes: string) =>
      `Listo. Tu cuota de ${mes} pasó a en verificación: dejas de figurar como pendiente y quien administra lo confirma contra el estado de cuenta.`,
    pagoConfirmado: (dpto: string, mes: string) =>
      `El pago del ${dpto} de ${mes} queda confirmado. Al día.`,
    mesPublicado: (mes: string) => `${mes} ya está publicado. Los siete pueden verlo.`,
    correccionHecha: (cuantas: number) =>
      cuantas === 0
        ? 'Corrección guardada. Ninguna cuota cambió de monto, y los siete tienen el aviso.'
        : `Corrección guardada. Cambiaron ${cuantas} ${cuantas === 1 ? 'cuota' : 'cuotas'}, y los siete tienen el aviso.`,
  },

  // ── Sin conexión · Fase 6 ──────────────────────────────────────────────
  /**
   * El aviso de que el teléfono no tiene señal.
   *
   * Dice **dos cosas** porque las dos importan: que estás desconectado, y que lo
   * que ves es lo último que se guardó —no datos de ahora—. Un aviso que solo
   * dijera "sin conexión" dejaría al vecino leyendo una cuota vieja creyendo que
   * es la de hoy, que es justo lo que el producto existe para evitar.
   */
  desconectado: {
    aviso: 'Sin conexión · estás viendo lo último que se guardó en este teléfono',
    // Los pasos del cierre escriben en el servidor. Sin señal no se guarda nada,
    // y hay que decirlo antes de que el administrador teclee siete lecturas.
    avisoAdmin: 'Sin conexión · no se puede guardar nada hasta que vuelva la señal',
    /**
     * Cuando el teléfono **cree** que está conectado y el servidor no contesta.
     *
     * Es el caso más común de la calle: wifi enganchado sin salida, portal
     * cautivo, datos agotados. `navigator.onLine` dice `true` —mide si hay
     * interfaz de red, no si hay servidor— así que el aviso de arriba no salía y
     * el vecino leía una cuota de hace semanas sin una marca. Se dice otra cosa
     * porque el problema es otro: no es que no haya conexión, es que **estos
     * datos no son de ahora**.
     */
    noLlega: 'No se pudo conectar · estos datos son los últimos que se guardaron',
    /** Con la fecha, cuando el service worker la sabe. */
    noLlegaCon: (cuando: string) => `No se pudo conectar · datos guardados ${cuando}`,
  },

  // ── Hojas ──────────────────────────────────────────────────────────────
  hojas: {
    avisoOk: {
      titulo: 'Listo, ya avisaste',
      texto:
        'Tu mes pasó a «en verificación». Deja de figurar como pendiente y quien administra lo confirma contra el estado de cuenta.',
    },
  },

  // ── Bob ────────────────────────────────────────────────────────────────
  bob: {
    nombre: 'Bob',
    subtitulo: 'lee todo el historial',
    campo: 'Escribe tu pregunta',
    sugeridas: [
      '¿Cuánto debo este mes?',
      '¿Por qué subió el agua?',
      '¿Quién falta por pagar?',
      '¿Qué es el lavado del 401?',
    ],
  },

  // ── El cierre del mes · 04-cierre-del-mes.md ───────────────────────────
  cierre: {
    paso: (n: number) => `Paso ${n} de 7`,
    // Paso 0
    titulo: (mes: string) => `Vamos a cerrar ${mes}`,
    intro:
      'Son siete pasos. Se guarda solo en cada uno, así que puedes salir y volver cuando quieras.',
    vasANecesitar: 'Vas a necesitar',
    necesitas: [
      { que: 'Las 7 lecturas de medidor', cuando: 'se leen el día 25' },
      { que: 'El recibo de SEDAPAL', cuando: 'los m³ y el monto' },
      { que: 'El recibo de luz común', cuando: 'solo el monto' },
    ],
    fijosPuestos: 'Los gastos fijos ya te los dejé puestos. Solo los confirmas en el paso 4.',
    empezar: 'Empezar',
    seguir: 'Seguir donde lo dejaste',
    // Paso 1
    lecturasTitulo: 'Las lecturas',
    lecturasIntro: 'Al lado tienes la del mes pasado.',
    contador: (hechas: number) => `${hechas} / 7`,
    anterior: (valor: string) => `anterior ${valor}`,
    consumo: (m3: string) => `consumo ${m3} m³`,
    escribirLectura: 'escribir la lectura',
    consumoAlto: (dpto: string) => `Es más del doble de lo habitual del ${dpto}. ¿Es correcto?`,
    /**
     * La propuesta de corrección de tecleo. `04-cierre-del-mes.md` § *Corrección de tecleo*.
     *
     * El documento la enseña con un caso: *«¿Será 438.038? Con 483.038 el consumo
     * sería 62.40 m³, cuatro veces tu promedio, y el edificio pasaría de lo que
     * facturó SEDAPAL.»* Esa frase se reproduce **literal** para ese caso —hay un
     * test que la compara carácter a carácter—, pero no se escribe fija: las dos
     * razones que enumera no son ciertas en todos los casos. Una lectura puede
     * fallar por quedarse **corta** contra la factura, o por retroceder. Un aviso
     * que afirma lo que no pasó es peor que no avisar, así que se arma con las
     * razones que de verdad se cumplen (`motivosLectura`).
     */
    propuesta: (p: {
      valor: string
      tecleado: string
      anterior: string
      consumoTecleado: string
      veces: number
      motivos: readonly MotivoLectura[]
    }) => {
      /**
       * Si el medidor retrocede **no se da el consumo**.
       *
       * Salía «el consumo sería -82.60 m³», que no es un dato: es el síntoma de
       * que la resta se hizo al revés, y la segunda mitad de la frase ya lo
       * explicaba mejor. Se dice lo que pasa y con qué compararlo.
       */
      if (p.motivos.includes('retrocede')) {
        return `¿Será ${p.valor}? Con ${p.tecleado} el medidor habría retrocedido: marcaría menos que el mes pasado, que fue ${p.anterior}.`
      }

      const cabeza = `¿Será ${p.valor}? Con ${p.tecleado} el consumo sería ${p.consumoTecleado} m³`
      const razones = p.motivos.map((m) => {
        switch (m) {
          case 'retrocede':
            // Tratado arriba, antes de llegar aquí.
            return 'el medidor habría retrocedido'
          case 'muyAlto':
            return VECES[p.veces] ?? `${p.veces} veces tu promedio`
          case 'muyBajo':
            return 'muy por debajo de tu promedio'
          case 'pasaFactura':
            return 'el edificio pasaría de lo que facturó SEDAPAL'
          case 'bajoFactura':
            // No se repite "muy por debajo": con `muyBajo` en la misma frase, las
            // dos razones se contaban con las mismas cuatro palabras y no se
            // distinguía si eran dos problemas o uno dicho dos veces.
            return 'al edificio le faltaría agua para llegar a lo que facturó SEDAPAL'
        }
      })
      if (razones.length === 0) return `${cabeza}.`
      if (razones.length === 1) return `${cabeza}, ${razones[0]}.`
      return `${cabeza}, ${razones.slice(0, -1).join(', ')}, y ${razones[razones.length - 1]}.`
    },
    propuestaSi: (valor: string) => `Sí, es ${valor}`,
    propuestaNo: 'No, lo dejo así',
    faltaUna: 'Falta una lectura',
    faltanVarias: (n: number) => `Faltan ${n} lecturas`,
    // Paso 2
    aguaTitulo: 'La factura de agua',
    aguaIntro: 'Del recibo de SEDAPAL, tal como viene en el papel.',
    campoM3: 'Consumo de agua del edificio',
    campoM3Largo: 'Consumo de agua del edificio · m³ de SEDAPAL',
    campoMonto: 'Monto de la factura de agua',
    campoMontoLargo: 'Monto de la factura de agua · SEDAPAL',
    // El descuento es opcional: la mayoría de recibos no lo traen. El mockup no
    // lo dibuja, pero el recibo real de SEDAPAL a veces rebaja el monto, y sin
    // esta casilla ese mes se cobraría de más. Se añade sin romper la regla de
    // «los dos datos» del paso: los dos obligatorios siguen siendo m³ y monto.
    campoDescuento: 'Descuento del recibo · opcional',
    campoDescuentoLargo: 'Descuento del recibo de SEDAPAL · déjalo en 0 si no hay',
    faltanDos: 'Escribe los dos datos',
    // Paso 3
    luzTitulo: 'El recibo de luz común',
    luzIntro: 'La luz de pasillos, ascensor y bomba. Solo el monto.',
    campoLuz: 'Monto del recibo de luz común',
    faltaMonto: 'Escribe el monto',
    // Paso 4
    fijosTitulo: 'Los gastos que no cambian',
    fijosIntro: 'Ya están puestos. Toca cualquiera si cambió de monto.',
    escribirMonto: 'Escribir monto',
    suman: 'Suman',
    confirmarSeguir: 'Confirmar y seguir',
    // Paso 5
    puntualTitulo: '¿Pasó algo fuera de lo normal?',
    puntualIntro: 'La mayoría de meses no pasa nada. Puedes seguir de largo sin añadir nada.',
    anadirGasto: 'Añadir un gasto extraordinario',
    anadirGastoEjemplo: 'reparación urgente, compra puntual',
    // Agregar un concepto fijo nuevo desde el paso 4 (data que se inyecta en vivo).
    anadirConcepto: 'Añadir un concepto fijo',
    anadirConceptoEjemplo: 'limpieza, un servicio nuevo, un mantenimiento anual',
    nombreConcepto: 'Nombre del concepto',
    conceptoAnual: 'Es anual (se divide entre 12)',
    conceptoRepetido: 'Ya existe un concepto con ese nombre.',
    conceptoConMonto: 'Poner monto',
    conceptoPorConfirmar: 'Dejar por confirmar',
    conceptoCancelar: 'Cancelar',
    anadirCredito: 'Añadir un crédito a un departamento',
    anadirCreditoEjemplo: 'alguien adelantó un pago',
    montoGasto: 'Monto del gasto extraordinario',
    montoCredito: 'Monto del crédito',
    anadidos: (n: number) => `Añadido este mes · ${n}`,
    seRepartte: 'se reparte entre los siete',
    aFavorDe: (dpto: string) => `a favor del ${dpto}`,
    reasignaciones: 'Reasignaciones de agua · ¿siguen?',
    lavadoActivo: 'activo · se descuenta del área común',
    lavadoInactivo: 'desactivado este mes',
    // `01` §3.3: activado, pero este mes no había de dónde sacarlo (poca área
    // común o reparto ajustado), así que no se aplicó. La app tiene que decirlo.
    lavadoNoAplicado: 'activado, pero este mes no había suficiente área común: no se aplicó',
    nadaMas: 'Nada más este mes, seguir',
    // Paso 6
    revisionTitulo: (mes: string) => `Así queda ${mes}`,
    revisionIntro: 'Revisa antes de que lo vean los siete.',
    totalDe: (mes: string) => `Total de ${mes}`,
    cuadraExacto: 'El agua cuadra exacto',
    cuadraAjustado: 'El agua cuadra · reparto ajustado',
    noCuadra: 'Los montos no cuadran',
    cuadraTexto:
      'Lo que pagan los siete más el área común es exactamente lo que facturó SEDAPAL.',
    loQuePagan: 'Lo que pagan los siete',
    areaComun: (m3: string) => `Área común del agua · ${m3} m³`,
    creditosAplicados: 'Créditos aplicados',
    creditosNota: 'salen del saldo de la cuenta, no de los demás vecinos',
    todoCorrecto: 'Todo correcto, seguir',
    revisaLecturas: 'Revisa las lecturas para seguir',
    revisaFactura: 'Revisa la factura para seguir',
    completaLoQueFalta: 'Completa lo que falta para seguir',
    // Paso 7
    notaTitulo: 'La nota del mes',
    notaIntro: 'Ya te la redacté con lo que ingresaste. Corrige lo que quieras — la leen los siete.',
    // Cuando el mes está vacío no hay nada que redactar; no se finge que sí.
    notaIntroVacia: 'Escribe la nota del mes. La leen los siete, así que cuéntales qué pasó, qué cambió y qué queda pendiente.',
    quePaso: 'Qué pasó',
    queCambio: 'Qué cambió',
    quePendiente: 'Qué queda pendiente',
    alPublicar: 'Al publicar',
    alPublicarPuntos: [
      'Los siete ven las cuotas del mes',
      'Les llega un aviso de que el mes ya está cerrado',
      'Si después se corrige algo, todos se enteran',
    ],
    publicar: (mes: string) => `Publicar ${mes}`,
    publicado: (mes: string) => `${mes} ya está publicado`,
    publicadoTexto: 'Los siete ya pueden ver sus cuotas y la nota del mes.',
    volverAlPanel: 'Volver al panel',
  },

  // ── Corregir un mes publicado · 04 §"Corregir un mes ya publicado" ─────
  correccion: {
    titulo: (mes: string) => `Corregir ${mes}`,
    intro:
      'Está permitido, y deja rastro. Al guardar se recalculan las cuotas y les llega un aviso a los siete con qué cambió.',
    lecturas: 'Las lecturas de este mes',
    motivo: 'Qué estás corrigiendo',
    motivoAyuda: 'Lo van a leer los siete en el aviso. Una línea basta.',
    guardar: 'Guardar la corrección y avisar',
    sinCambios: 'Cambia algo para poder corregir',
    sinMotivo: 'Escribe qué estás corrigiendo',
    hecho: 'Listo, los siete ya lo saben',
    corregirMes: 'Corregir un mes publicado',
  },

  // ── Administración ─────────────────────────────────────────────────────
  pagos: {
    // Confirmar un pago que entró por un monto distinto de la cuota.
    otroMonto: 'Entró otro monto',
    otroMontoEtiqueta: (dpto: string) => `¿Cuánto entró del ${dpto}?`,
  },
  push: {
    titulo: 'Avisos en este teléfono',
    explica: 'Te avisamos cuando se publique o corrija un mes.',
    bloqueado: 'Los avisos están bloqueados en los ajustes del navegador.',
    activar: 'Activar',
    activando: 'Activando…',
    desactivar: 'Desactivar',
  },
  avisar: {
    titulo: 'Avísales a los demás',
    copiar: 'Copiar el mensaje',
    copiado: '¡Copiado!',
    whatsapp: 'Abrir WhatsApp',
    // Mensaje listo para pegar en el grupo. Cálido, claro, sin sonar a cobrador.
    mensajePublicado: (mes: string, total: string, url: string) =>
      `Vecinos, ya está el cierre de ${mes}: S/ ${total} en total, repartido entre los siete. Pueden ver su cuota y cómo pagar acá: ${url}`,
    mensajeCorreccion: (mes: string, url: string) =>
      `Vecinos, corregí el cierre de ${mes}. Revisen su cuota actualizada acá: ${url}`,
  },
  admin: {
    entrar: 'Administrar el edificio',
    pinTitulo: 'Administrar el edificio',
    pinTexto: 'La clave la tiene quien administra.',
    /**
     * Lo que oye quien teclea el PIN **sin ver la pantalla**.
     *
     * El PIN incorrecto no lleva mensaje a propósito —solo sacude el campo y lo
     * limpia (`README` §7)—, así que sin esto no había ninguna señal: ni cuántos
     * dígitos llevaba, ni que se había vaciado. Se tecleaba a ciegas.
     */
    pinDigitos: (cuantos: number) =>
      cuantos === 0 ? 'Sin dígitos.' : `${cuantos} de 4 dígitos.`,
    titulo: 'Administración',
  },
} as const

export type Copys = typeof COPYS
