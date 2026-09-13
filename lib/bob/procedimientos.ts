/**
 * Cómo se hace cada cosa en la app, escrito para que Bob lo pueda decir.
 *
 * ## Por qué esto existe y no está en el prompt
 *
 * Porque de lo contrario **no se puede decir**. La guarda de números descarta
 * la respuesta entera si aparece una cifra que no salió de una herramienta, y
 * una instrucción está llena de cifras: «paso 5», «el 502», «los siete». Un
 * Bob que intenta guiar con el procedimiento en el prompt se autodestruye en la
 * primera frase, y el vecino ve la respuesta corta del catálogo sin entender
 * por qué.
 *
 * Metiéndolo en una herramienta, los números del procedimiento pasan a estar
 * respaldados por una llamada, que es justo lo que la guarda pide. Y de paso el
 * procedimiento queda **auditado**: sale en `consulta_bob` con el resultado de
 * la llamada, así que se puede leer qué se le dijo exactamente a quién.
 *
 * ## Qué NO es
 *
 * No es una promesa de que Bob lo haga. Bob no escribe nunca: explica dónde
 * está el botón y quién lo aprieta. Cada texto de aquí está redactado en esa
 * clave.
 */

/** Un caso de los que pasan de verdad, con su receta. */
export interface Procedimiento {
  /** El identificador con el que se pide. */
  caso: string
  /** Cómo lo diría un vecino. Sirve para encontrarlo por texto. */
  seDiceAsi: readonly string[]
  /** Una frase: qué es esto. */
  queEs: string
  /** Dónde se hace, en palabras de la interfaz. */
  donde: string
  /** El procedimiento, paso a paso. */
  pasos: readonly string[]
  /** Lo que hay que mirar para saber que salió bien, o lo que suele salir mal. */
  ojoCon?: string
}

/**
 * Los casos atípicos, tal como aparecen en el edificio.
 *
 * Salen de la historia real: el token que adelantó el 401, el tanque
 * hidroneumático repartido en partes iguales, el portón que el primer piso no
 * usa, la deuda del 501 condonada, y el vecino que deposita de más «para el
 * mes que viene». No son ejemplos inventados para una demo.
 */
export const PROCEDIMIENTOS: readonly Procedimiento[] = [
  {
    caso: 'gasto-extra',
    seDiceAsi: ['gasto extra', 'gasto extraordinario', 'gasto puntual', 'compramos', 'se malogro', 'reparacion', 'arreglo', 'boleta'],
    queEs: 'Un gasto que pasa una vez y no es de todos los meses.',
    donde: 'Paso 4 del cierre, en «Gastos extraordinarios».',
    pasos: [
      'Agrega el concepto y el monto exacto de la boleta.',
      'Elige quiénes lo pagan: por defecto los siete.',
      'Deja el reparto en «por porcentaje» salvo que se haya acordado otra cosa.',
    ],
    ojoCon:
      'El monto va con IGV incluido si la boleta lo trae: lo que se reparte es lo que salió de la cuenta.',
  },
  {
    caso: 'gasto-que-no-paga-alguien',
    seDiceAsi: ['no le sirve', 'no usan', 'no todos pagan', 'no lo pagan todos', 'primer piso', 'porton', 'garaje', 'cochera', 'no paga ese gasto', 'solo algunos', 'excluir'],
    queEs: 'Un gasto que no beneficia a todos, como el portón que el primer piso no usa.',
    donde: 'Paso 4 del cierre, en el gasto extraordinario, desmarcando a quien no participa.',
    pasos: [
      'Registra el gasto normalmente.',
      'Desmarca a los departamentos que no lo pagan.',
      'El reparto se renormaliza solo: los que quedan pasan a ser el cien por ciento y conservan la proporción entre ellos.',
    ],
    ojoCon:
      'Renormalizar no es repartir en partes iguales. Quien tiene más metraje sigue pagando más, solo que ahora sobre una base más chica.',
  },
  {
    caso: 'pago-adelantado',
    seDiceAsi: ['adelantado', 'por adelantado', 'deposito de mas', 'deposito mas', 'pago de mas', 'pago mas de', 'mas de lo que', 'a cuenta', 'saldo a favor', 'le sobra', 'quedo a favor'],
    queEs: 'Alguien deposita más de lo que dice su cuota, o paga antes de que se publique el mes.',
    donde: 'Paso 5 del cierre, en «Pagos».',
    pasos: [
      'Registra el monto que de verdad entró a la cuenta, no la cuota.',
      'La diferencia queda como saldo a favor de ese departamento y se ve en su pantalla.',
      'El mes siguiente se le descuenta de lo que le toque.',
    ],
    ojoCon:
      'Si todavía no está publicado el mes que quiere adelantar, el pago se registra igual en el mes en curso: el saldo a favor se arrastra solo.',
  },
  {
    caso: 'pago-parcial',
    seDiceAsi: ['pago la mitad', 'la mitad', 'pago parte', 'abono parcial', 'pago incompleto', 'falta parte', 'pago menos', 'deposito menos', 'menos de su cuota'],
    queEs: 'Depositó menos de su cuota.',
    donde: 'Paso 5 del cierre, en «Pagos».',
    pasos: [
      'Registra el monto exacto que entró.',
      'Lo que falta queda como pendiente del departamento y se ve en su pantalla.',
    ],
    ojoCon: 'No se registra la cuota completa «para que cuadre»: la cuenta del edificio dejaría de coincidir con el banco.',
  },
  {
    caso: 'condonar',
    seDiceAsi: ['condonar', 'condonacion', 'perdonar la deuda', 'ya fue', 'borron y cuenta nueva', 'no va a pagar', 'no deba nada', 'que no deba', 'olvidar la deuda', 'nunca va a pagar'],
    queEs: 'Se acuerda que una deuda no se va a cobrar.',
    donde: 'Paso 4 del cierre del mes de esa deuda, como crédito al departamento.',
    pasos: [
      'Agrega un crédito a nombre de ese departamento por el monto exacto de su cuota.',
      'Su cuota de ese mes queda en cero y deja de figurar como pendiente.',
      'El gasto sigue ahí: lo absorbe la cuenta del edificio, y por eso el saldo baja.',
    ],
    ojoCon:
      'Un crédito es un monto fijo y no se mueve solo. Si después se corrige ese mes y la cuota cambia, hay que ajustar el crédito a mano.',
  },
  {
    caso: 'corregir-mes-publicado',
    seDiceAsi: ['corregir', 'corrijo', 'correccion', 'me equivoque', 'esta mal la lectura', 'lectura mal', 'cambiar un mes cerrado', 'mes ya cerrado', 'ya publicado', 'mes cerrado'],
    queEs: 'Un mes ya publicado tenía un dato mal.',
    donde: 'En el mes publicado, con «Corregir».',
    pasos: [
      'Cambia el dato que estaba mal.',
      'La app recalcula y muestra qué cuota se mueve y cuánto, antes de guardar.',
      'Al confirmar, queda una nueva versión del mes y a los siete les llega el aviso con lo que cambió.',
    ],
    ojoCon: 'Nada se borra: la versión anterior sigue guardada y se puede ver qué decía.',
  },
  {
    caso: 'cambiar-un-gasto-fijo',
    seDiceAsi: ['subio la guardiania', 'aumento', 'nuevo precio', 'cambio el monto', 'cambiar el monto', 'cambio de monto', 'ahora cuesta', 'subieron'],
    queEs: 'Un gasto de todos los meses cambia de monto.',
    donde: 'Paso 4 del cierre, en el concepto que cambió.',
    pasos: [
      'Cambia el monto y di desde qué mes rige.',
      'Los meses anteriores no se tocan: siguen con el monto que tenían.',
    ],
    ojoCon: 'Si el aumento era desde antes, hay que corregir esos meses uno por uno: cambiar el monto no reescribe el pasado.',
  },
  {
    caso: 'concepto-nuevo',
    seDiceAsi: ['gasto nuevo', 'nuevo concepto', 'concepto nuevo', 'agregar concepto', 'ahora pagamos', 'contratamos', 'todos los meses'],
    queEs: 'Aparece un gasto mensual que antes no existía.',
    donde: 'Paso 4 del cierre, con «Agregar concepto».',
    pasos: [
      'Escribe el nombre y el monto, y desde qué mes empieza a cobrarse.',
      'A partir de ahí entra solo todos los meses.',
    ],
  },
  {
    caso: 'lavado-de-vehiculo',
    seDiceAsi: ['dejo de lavar', 'ya no lavo', 'lavado', 'lavar el carro', 'quitar el lavado', 'sacar el lavado', 'desmarcar el lavado'],
    queEs: 'Los metros cúbicos del lavado del carro, que salen del caño común y se le cargan a quien lava.',
    donde: 'Paso 5 del cierre, en la casilla del lavado.',
    pasos: [
      'Desmarca la casilla el mes en que deja de lavar.',
      'Esos metros cúbicos vuelven al área común y se reparten entre los siete.',
      'Si cambia la cantidad, el valor se edita ahí mismo y rige desde ese mes.',
    ],
    ojoCon: 'Los meses ya publicados guardan el valor con el que se calcularon y no se mueven al cambiar el actual.',
  },
  {
    caso: 'cambio-de-dueno',
    seDiceAsi: ['se mudo', 'nuevo dueno', 'nuevo propietario', 'vendio', 'cambio de propietario', 'cambio de dueno', 'ahora vive'],
    queEs: 'Cambia quién vive o quién es dueño de un departamento.',
    donde: 'En la configuración del edificio, en el departamento.',
    pasos: [
      'Cambia el nombre del departamento.',
      'El porcentaje no se toca: sale de la escritura y no depende de quién viva ahí.',
    ],
    ojoCon: 'Lo que quedó pendiente sigue asociado al departamento, no a la persona.',
  },
  {
    caso: 'publicar',
    seDiceAsi: ['publicar', 'publico el mes', 'cerrar el mes', 'avisar a los demas', 'avisarles', 'mandar al grupo'],
    queEs: 'Dar por cerrado el mes y avisarles a los siete.',
    donde: 'Paso 7 del cierre.',
    pasos: [
      'Revisa que el paso 6 diga que cuadra: si no cuadra, no deja publicar.',
      'Publica, y a los siete les llega el aviso.',
      'Copia el mensaje que aparece y pégalo en el grupo, para los que no tengan la app abierta.',
    ],
  },
  {
    caso: 'no-cuadra',
    seDiceAsi: ['no cuadra', 'no me deja publicar', 'no deja publicar', 'descuadre', 'no suma', 'sobra plata', 'falta plata'],
    queEs: 'Las siete cuotas no suman el total del mes, y por eso el cierre no deja publicar.',
    donde: 'Se revisa en el paso 6, que dice cuánto falta o cuánto sobra.',
    pasos: [
      'Revisa la factura de agua: el monto y los metros cúbicos tienen que ser los del recibo, con descuento si lo trae.',
      'Revisa que estén las siete lecturas y que ninguna sea menor que la del mes anterior.',
      'Revisa los gastos extraordinarios: un crédito sin su gasto, o al revés, descuadra el mes.',
    ],
    ojoCon: 'No se publica un mes que no cuadra. El bloqueo es a propósito.',
  },
] as const

/** Todos los identificadores, para el esquema de la herramienta y para los tests. */
export const CASOS = PROCEDIMIENTOS.map((p) => p.caso)

/** Minúsculas y sin tildes, que es como están escritas las claves de búsqueda. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Busca el procedimiento que corresponde a un texto libre.
 *
 * **Gana la coincidencia más larga, no la primera.** Con «la primera gana»,
 * *«compramos un portón y no le sirve al primer piso»* se respondía con el
 * procedimiento del gasto extra normal, porque «compramos» está antes en la
 * lista que «no le sirve»: justo el caso donde saber que se puede excluir a
 * alguien es la mitad de la respuesta. La coincidencia larga es la específica.
 *
 * `null` si no encaja ninguno: Bob no fuerza una receta que no viene al caso,
 * porque una instrucción equivocada sobre dinero es peor que un «no sé».
 */
export function procedimientoPara(texto: string): Procedimiento | null {
  const t = normalizar(texto)
  const exacto = PROCEDIMIENTOS.find((p) => p.caso === t)
  if (exacto) return exacto

  let mejor: Procedimiento | null = null
  let largo = 0
  for (const p of PROCEDIMIENTOS) {
    for (const f of p.seDiceAsi) {
      if (t.includes(f) && f.length > largo) {
        largo = f.length
        mejor = p
      }
    }
  }
  return mejor
}

/**
 * ¿Esto es una pregunta de «cómo se hace», y no de «cuánto es»?
 *
 * Se mira aparte de las palabras del caso porque las dos señales son
 * independientes: *«subió la guardianía»* es un hecho y *«cómo cambio el
 * monto»* es un trámite, y solo juntas piden un procedimiento. Con una lista
 * fija de frases enteras no alcanzaba: *«cómo lo registro»*, con un «lo» en
 * medio, no calzaba con «como registro» y se iba por la rama del banco, que
 * respondía sobre depósitos a quien preguntaba por un formulario.
 */
export function suenaAComo(texto: string): boolean {
  const t = normalizar(texto)
  return /(\bcomo\b|\bque hago\b|\bque tengo que hacer\b|\bdonde\b|\bse puede\b|\bhay que\b|\bque pasa si\b|\bpaso a paso\b|\bno me deja\b)/.test(
    t,
  )
}
