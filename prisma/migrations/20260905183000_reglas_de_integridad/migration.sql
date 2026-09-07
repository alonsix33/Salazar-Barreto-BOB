-- Reglas que el esquema de Prisma no sabe expresar y que la base sí puede
-- garantizar. Son la última red: aunque una ruta de la API se olvidara de
-- validar, la base no acepta una fila incoherente.

-- Un crédito es siempre a favor de un departamento concreto: sale del saldo de
-- la cuenta y se le resta a alguien. Un crédito sin dueño se evaporaría.
ALTER TABLE "gasto_extra"
  ADD CONSTRAINT "credito_exige_dpto"
  CHECK ("tipo" <> 'credito' OR "dptoId" IS NOT NULL);

-- Un gasto extraordinario lo pagan los siete por flat: no lleva departamento.
ALTER TABLE "gasto_extra"
  ADD CONSTRAINT "gasto_no_lleva_dpto"
  CHECK ("tipo" <> 'gasto' OR "dptoId" IS NULL);

-- Los montos de dinero no son negativos. Un descuento mayor que la factura, o
-- una lectura negativa, son errores de tecleo, no datos.
ALTER TABLE "gasto_extra" ADD CONSTRAINT "monto_no_negativo" CHECK ("monto" >= 0);
ALTER TABLE "gasto_fijo"  ADD CONSTRAINT "monto_no_negativo" CHECK ("monto" IS NULL OR "monto" >= 0);
ALTER TABLE "lectura"     ADD CONSTRAINT "lectura_no_negativa" CHECK ("valor" >= 0);
ALTER TABLE "recibo"      ADD CONSTRAINT "agua_m3_no_negativo" CHECK ("aguaM3" >= 0);
ALTER TABLE "recibo"      ADD CONSTRAINT "agua_monto_no_negativo" CHECK ("aguaMonto" >= 0);
ALTER TABLE "recibo"      ADD CONSTRAINT "luz_no_negativa" CHECK ("luz" >= 0);
ALTER TABLE "reasignacion_agua" ADD CONSTRAINT "m3_no_negativos" CHECK ("m3" >= 0);

-- El descuento de SEDAPAL no puede ser mayor que el monto de la factura: eso
-- daría un precio del m³ negativo, cuotas negativas, y los dos cuadres de
-- 01 §5 lo dejarían pasar porque son identidades algebraicas.
ALTER TABLE "recibo"
  ADD CONSTRAINT "descuento_no_supera_el_monto"
  CHECK ("descuento" IS NULL OR "descuento" <= "aguaMonto");

-- Un mes es 'AAAA-MM'. Sin esto, un '2026-13' o un 'junio' entran y luego el
-- motor pinta "undefined 2026" en la pantalla del vecino.
ALTER TABLE "lectura"  ADD CONSTRAINT "mes_bien_formado" CHECK ("mes" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "recibo"   ADD CONSTRAINT "mes_bien_formado" CHECK ("mes" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "pago"     ADD CONSTRAINT "mes_bien_formado" CHECK ("mes" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "cierre"   ADD CONSTRAINT "mes_bien_formado" CHECK ("mes" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "gasto_extra" ADD CONSTRAINT "mes_bien_formado" CHECK ("mes" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "gasto_fijo" ADD CONSTRAINT "vigencia_bien_formada" CHECK ("vigenteDesde" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "reasignacion_agua" ADD CONSTRAINT "desde_bien_formado" CHECK ("desde" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "reasignacion_activa_mes" ADD CONSTRAINT "mes_bien_formado" CHECK ("mes" ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- El paso del cierre va de 0 a 7.
ALTER TABLE "cierre" ADD CONSTRAINT "paso_en_rango" CHECK ("paso" >= 0 AND "paso" <= 7);

-- Un mes publicado tiene siempre quién y cuándo.
ALTER TABLE "cierre"
  ADD CONSTRAINT "publicado_con_firma"
  CHECK ("publicado" = false OR ("publicadoPor" IS NOT NULL AND "publicadoEn" IS NOT NULL));

-- Solo hay una fila de configuración.
ALTER TABLE "configuracion_edificio" ADD CONSTRAINT "fila_unica" CHECK ("id" = 1);
