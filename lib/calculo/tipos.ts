/**
 * Tipos del motor de cálculo.
 *
 * `ResultadoMes` expone **todos** los campos de `01-reglas-de-negocio.md` §11,
 * porque la interfaz los consume tal cual.
 */

/** Identificador de mes, `'AAAA-MM'`. */
export type MesId = string & { readonly __marca?: 'MesId' }

/** Los siete departamentos del edificio. */
export type DptoId = '101' | '201' | '202' | '301' | '401' | '501' | '502'

export interface Departamento {
  readonly id: DptoId
  readonly nombre: string
  /** Porcentaje de participación de la escritura. Los siete suman 100.00. */
  readonly flat: number
  readonly piso: number
}

/** Un registro por departamento. Parcial: puede faltar alguno. */
export type Lecturas = Partial<Record<DptoId, number>>

/** Un registro por departamento, completo. */
export type PorDpto<T> = Record<DptoId, T>

/** El recibo del mes, tal como viene en el papel. */
export interface Recibo {
  /** m³ que facturó SEDAPAL del medidor matriz. */
  aguaM3: number
  /** Monto de la factura de agua, antes del descuento. */
  aguaMonto: number
  /** Monto del recibo de luz común. */
  luz: number
  /** Descuento de SEDAPAL, si lo hubo. */
  descuento?: number | null
}

/** Un concepto de gasto con su monto. `null` significa "por confirmar". */
export interface GastoFijo {
  readonly concepto: string
  readonly monto: number | null
  readonly anual?: boolean
  readonly porConfirmar?: boolean
}

/** Una línea de la lista de gastos del mes que devuelve el motor. */
export interface LineaGasto {
  concepto: string
  monto: number | null
  anual?: boolean
  porConfirmar?: boolean
  /** Marca la línea de la factura de agua: la interfaz la pinta en celeste. */
  esAgua?: boolean
  /** Marca un gasto extraordinario añadido en el paso 5 del cierre. */
  extra?: boolean
}

/**
 * Lo puntual del mes.
 * - `gasto` se suma a `totalMes` y lo pagan los siete por su porcentaje, como
 *   todo lo demás. No hay reparto equitativo.
 * - `credito` se resta de la cuota de un departamento y sale del saldo de la cuenta.
 */
export type Extra =
  | { tipo: 'gasto'; concepto: string; monto: number; dpto?: null }
  | { tipo: 'credito'; concepto?: string; monto: number; dpto: DptoId }

/**
 * Las entradas guardadas de un mes. Es lo que el motor necesita para calcular,
 * y lo único que la base de datos guarda: las cuotas se calculan al vuelo.
 */
export interface EntradasMes {
  readonly mesId: MesId
  /** `null` mientras el administrador no haya escrito el recibo. */
  readonly recibo: Recibo | null
  /** Lecturas del mes. Pueden faltar departamentos mientras se está cerrando. */
  readonly lecturas: Lecturas
  /** Lecturas del mes anterior. Sin ellas no hay consumo que calcular. */
  readonly lecturasAnteriores: Lecturas
  /** Los conceptos fijos vigentes en este mes, con su monto. */
  readonly fijos: readonly GastoFijo[]
  /** Gastos extraordinarios y créditos de este mes. */
  readonly extras: readonly Extra[]
  /** m³ del lavado configurados. 0 lo desactiva. */
  readonly lavadoM3: number
}

/**
 * Lo que el administrador está escribiendo y todavía no guardó.
 * Cada campo pisa la entrada guardada individualmente (`01` §11).
 */
export interface Overrides {
  recibo?: Partial<Recibo>
  lecturas?: Lecturas
  /** Por concepto: `{ 'Ascensor': 700 }`. `null` lo deja por confirmar. */
  fijos?: Record<string, number | null>
  extras?: readonly Extra[]
  /** 0 desactiva el lavado este mes. */
  lavadoM3?: number
}

/** La cuota de un departamento, con todo su desglose. */
export interface CuotaDpto {
  /** Parte del gasto común que le toca por flat. */
  mantenimiento: number
  /** Lo que paga de agua por los m³ que se le cobran. */
  agua: number
  /** Crédito a su favor. Sale del saldo de la cuenta, no de los demás. */
  credito: number
  /** `mantenimiento + agua − credito`. */
  total: number
  /** m³ que se le cobran (medidos, ajustados si aplica, más el lavado si es suyo). */
  m3: number
  /** m³ que midió su medidor, sin ajuste ni lavado. */
  m3medidos: number
  /** m³ del lavado reasignados a este departamento. 0 para los demás. */
  lavado: number
  lecturaAnterior: number
  lecturaActual: number
}

/** Todo lo que una pantalla puede necesitar de un mes. `01` §11. */
export interface ResultadoMes {
  readonly mesId: MesId
  /**
   * `false` cuando falta el recibo, faltan las lecturas del mes anterior o
   * SEDAPAL facturó 0 m³. Nunca se devuelve `null` ni un `NaN`.
   */
  readonly valido: boolean
  /** Qué falta, cuando `valido` es `false`. `null` si el mes es válido. */
  readonly motivoInvalido: string | null
  /**
   * Los departamentos cuya lectura falta, cuando `valido` es `false` por eso.
   * La interfaz los usa para señalar exactamente qué filas hay que completar.
   */
  readonly dptosSinLectura: readonly DptoId[]

  /** Recibo efectivo tras aplicar los overrides. */
  readonly rec: Recibo
  /** Lo que midió cada medidor este mes. */
  readonly consumos: PorDpto<number>
  /** Suma de los siete medidores. */
  readonly sumaMedida: number
  /** Monto de la factura menos el descuento. */
  readonly facturaAgua: number
  /** Precio del m³. **Sin redondear**: se arrastra a precisión completa. */
  readonly precioM3: number
  /** `m3Sedapal − sumaMedida`. Negativo dispara el reparto ajustado. */
  readonly brutoComun: number
  /** El bruto menos los m³ del lavado. */
  readonly comunReal: number
  /** m³ reasignados al 401 este mes. 0 si no aplica. */
  readonly lavado: number
  /** El reparto proporcional está activo. */
  readonly ajustado: boolean
  /** Coeficiente del ajuste. 1 si no aplica. */
  readonly factor: number
  /** Lo que cuesta el área común. 0 en reparto ajustado. */
  readonly montoComun: number
  /** Los conceptos del mes con su monto. */
  readonly gastos: readonly LineaGasto[]
  /** Suma de los gastos, tratando `null` como 0. */
  readonly totalMes: number
  /** `totalMes − facturaAgua`. Es la base del reparto por flat. */
  readonly baseMant: number
  readonly cuotas: PorDpto<CuotaDpto>
  readonly sumaAgua: number
  readonly sumaCuotas: number
  readonly totalCreditos: number
  /** `Σ agua + montoComun ≈ facturaAgua`, tolerancia 0.03. */
  readonly cuadraAgua: boolean
  /** El mismo cuadre del agua, pero en m³ y sin el precio de por medio. */
  readonly cuadraM3: boolean
  /** Los m³ que se le cobran a los siete, sumados. */
  readonly sumaM3Cobrados: number
  /** `Σ cuota + montoComun + Σ créditos ≈ totalMes`, tolerancia 0.05. */
  readonly cuadraMes: boolean
  /**
   * El tercer cuadre: ninguna cifra imposible por construcción.
   *
   * Los dos de arriba son identidades algebraicas y se cumplen igual con
   * números absurdos. Ver `sanidad.ts`.
   */
  readonly cuadraSanidad: boolean
  /** Qué está mal, en el idioma del vecino. Vacío si `cuadraSanidad`. */
  readonly motivosSanidad: readonly string[]
  /** Los tres a la vez. Es lo que el paso 6 del cierre exige para publicar. */
  readonly cuadra: boolean
  /** El descuento aplicado, 0 si no hubo. */
  readonly descuento: number
}

/** Una fila de la serie del saldo de la cuenta. */
export interface FilaSaldo {
  mes: MesId
  corto: string
  /** Σ cuota de los que pagaron **y están confirmados**. */
  recibido: number
  /** `totalMes`. */
  gastado: number
  /** `recibido − gastado`. */
  delta: number
  /** Saldo al cierre de ese mes. */
  saldo: number
}

/** Estado de un pago. `01` §7. Sin registrar se representa con la ausencia de fila. */
export type EstadoPago = 'confirmado' | 'aviso'

export interface Pago {
  estado: EstadoPago
  fecha: string
  /** Cuánto entró de verdad. `null`/omitido = pagó justo su cuota. */
  monto?: number | null
  op?: string | null
  texto?: string | null
}

/** Los pagos de un mes, por departamento. */
export type PagosMes = Partial<Record<DptoId, Pago | null>>

/** La corrección de tecleo que `proponerCorreccion` devuelve. `01` §8. */
export interface Correccion {
  valor: number
  consumo: number
}
