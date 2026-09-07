/**
 * Un mensaje de error que **se oye**, no solo se ve.
 *
 * Existe porque no se oía. Un vecino ciego pulsaba «Ya transferí, avisar», el
 * servidor fallaba, aparecía un texto en ámbar que él no veía, la región de
 * anuncios se quedaba vacía y el botón seguía diciendo lo mismo. Se iba
 * convencido de haber avisado. Es exactamente lo que esta app existe para
 * evitar, y pasaba en los siete pasos del cierre, en corregir, en cargos, en
 * exportar y en el PIN.
 *
 * `role="alert"` y no `status`: un fallo **interrumpe**. Es lo único de estas
 * pantallas que lo hace.
 *
 * Ámbar y nunca rojo (`02` §1 regla 3), como todo lo demás.
 */
export function Fallo({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="tipo-cuerpo-menor text-ambar fallo">
      {children}
    </p>
  )
}
