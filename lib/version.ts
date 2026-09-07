/**
 * El sello de este despliegue.
 *
 * Lo pone `scripts/construir.mjs` en el momento del build —del commit, o de la
 * hora si no hay git— y **cambia en cada despliegue**. Lo usa el registro del
 * service worker: sin un sello que cambie, `public/sw.js` es el mismo fichero
 * byte a byte, el navegador nunca ve un service worker nuevo, y las cachés
 * viejas no se borran nunca.
 *
 * En desarrollo vale `dev`, que también es correcto: allí no hay despliegues.
 */
export const VERSION_APP = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
