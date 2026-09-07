/**
 * El departamento elegido, guardado **en el dispositivo**.
 *
 * `06` §5: se elige una vez y no hay contraseña. Los datos son públicos entre
 * los siete por diseño — la transparencia es el punto.
 *
 * Va en una cookie y no en `localStorage` como el prototipo, por una razón
 * concreta: así el servidor puede pintar Inicio ya con los datos del vecino, sin
 * un parpadeo de "cargando" en cada arranque. No es una cookie de sesión ni de
 * seguridad: es una preferencia.
 */

export const COOKIE_DPTO = 'sb_dpto'

/** Un año. Si el vecino no entra en un año, volver a elegir no es grave. */
export const DURACION_DPTO = 60 * 60 * 24 * 365
