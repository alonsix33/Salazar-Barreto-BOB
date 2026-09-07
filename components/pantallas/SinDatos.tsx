/**
 * Estado vacío con sentido. Fase 4, punto 6 del verificador.
 *
 * Un mes sin lecturas, sin recibo y sin pagos **no puede reventar**, y tampoco
 * puede mostrar ceros como si fueran datos. Dice qué falta y quién lo arregla.
 */
export function SinDatos({ motivo }: { motivo?: string | null }) {
  return (
    <div className="pantalla scroll-limpio sin-datos">
      <h1 className="tipo-titulo-hoja sin-datos-titulo">Todavía no hay nada que mostrar</h1>
      <p className="tipo-cuerpo text-gris sin-datos-texto">
        {motivo ??
          'Cuando quien administra cierre el primer mes, aquí aparecen las cuotas de los siete y cómo se calculó cada una.'}
      </p>
    </div>
  )
}
