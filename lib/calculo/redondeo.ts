/**
 * Redondeo y formato · `01-reglas-de-negocio.md` §9.
 *
 * Todos los redondeos del motor usan `Math.round(x * 100) / 100`. No se cambia
 * el orden de las operaciones ni el sitio donde cae cada redondeo: el cuadre
 * de los dos controles (`cuadraAgua`, `cuadraMes`) depende de eso.
 */

/**
 * Montos en soles y consumos en m³: 2 decimales.
 *
 * El `|| 0` del final normaliza el cero negativo. `Math.round(-0.004)` devuelve
 * `-0`, y un `-0` que llega al formateador se pinta **`S/ -0.00`** en la
 * pantalla del vecino. No cambia ninguna comparación —`-0 < 0` ya era `false`—,
 * solo evita un menos que no significa nada.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100 || 0
}

/** Lecturas de medidor: 3 decimales, que es como vienen del medidor. */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000 || 0
}

/**
 * Formato de salida de un monto o un consumo.
 *
 * La llamada es literalmente la que fija `01` §9. En el ICU actual devuelve
 * `1,234.56`; el documento la ilustra como `1 234.56`. Manda la llamada, que es
 * lo que ejecuta el prototipo en el navegador. Ver `docs/verificacion-1.md`.
 */
export function fmt(n: number | null | undefined): string {
  // No finito incluye `NaN`, `Infinity` y `-Infinity`. Sin este guardián,
  // `fmt(Infinity)` pintaba `∞` en una cuota.
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return (n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Formato de una lectura de medidor: 3 decimales. */
export function fmt3(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return (n || 0).toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}
