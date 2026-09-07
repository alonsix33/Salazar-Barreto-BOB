-- Congelar los m³ del lavado al publicar el mes.
--
-- Hasta aquí el valor vivía solo en `reasignacion_agua.m3`, uno global para
-- todos los meses. Cambiarlo movía la cuota del 401 en los meses **ya
-- publicados** —de 1.50 a 3.00 son S/ 6.25 en junio de 2026— mientras el aviso
-- que se les mandaba a los siete decía que los meses cerrados no se tocan.
--
-- A partir de ahora, publicar un mes graba aquí los m³ en vigor y ese mes queda
-- congelado. `NULL` significa "sigue el valor actual de la reasignación", que es
-- lo correcto para un mes que todavía no se ha publicado.

ALTER TABLE "reasignacion_activa_mes" ADD COLUMN "m3" DECIMAL(6,2);

-- Un mes ya publicado no puede quedar suelto: se le congela lo que hay hoy, que
-- es exactamente con lo que se calculó su cuota.
--
-- **La herencia importa.** Un mes publicado sin marca propia no está activo por
-- omisión: hereda la marca del mes anterior (`lavadoM3En`). Insertar `TRUE` a
-- ciegas encendía el lavado en un mes que lo tenía apagado, y eso son S/ 6.25 en
-- la cuota publicada del 401. Así que `activa` se copia de la marca del mes
-- anterior cuando existe, y solo a falta de las dos se asume activa, que es lo
-- mismo que hace el código.
INSERT INTO "reasignacion_activa_mes" ("id", "reasignacionId", "mes", "activa", "m3")
SELECT
  md5(r."id" || ':' || c."mes"),
  r."id",
  c."mes",
  COALESCE(previo."activa", TRUE),
  CASE WHEN COALESCE(previo."activa", TRUE) THEN r."m3" ELSE NULL END
FROM "cierre" c
CROSS JOIN "reasignacion_agua" r
LEFT JOIN "reasignacion_activa_mes" previo
  ON previo."reasignacionId" = r."id"
 AND previo."mes" = to_char((to_date(c."mes", 'YYYY-MM') - INTERVAL '1 month'), 'YYYY-MM')
WHERE c."publicado" = TRUE
  AND c."mes" >= r."desde"
ON CONFLICT ("reasignacionId", "mes") DO NOTHING;

-- Y a las marcas que ya existían para meses publicados se les congela el valor.
-- Solo a las activas: una desmarcada se queda en NULL, que es "sin lavado".
UPDATE "reasignacion_activa_mes" a
SET "m3" = r."m3"
FROM "reasignacion_agua" r, "cierre" c
WHERE a."reasignacionId" = r."id"
  AND a."mes" = c."mes"
  AND c."publicado" = TRUE
  AND a."activa" = TRUE
  AND a."m3" IS NULL;

-- Los m³ congelados no pueden ser negativos: un lavado que resta agua al área
-- común en vez de sumarla no existe.
ALTER TABLE "reasignacion_activa_mes"
  ADD CONSTRAINT "lavado_congelado_no_negativo" CHECK ("m3" IS NULL OR "m3" >= 0);
