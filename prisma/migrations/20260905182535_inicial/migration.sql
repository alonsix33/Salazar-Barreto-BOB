-- CreateEnum
CREATE TYPE "tipo_extra" AS ENUM ('gasto', 'credito');

-- CreateEnum
CREATE TYPE "estado_pago" AS ENUM ('confirmado', 'aviso');

-- CreateEnum
CREATE TYPE "tipo_aviso" AS ENUM ('mes_publicado', 'pago_confirmado', 'correccion', 'gasto_fijo', 'reasignacion', 'recordatorio');

-- CreateTable
CREATE TABLE "departamento" (
    "id" VARCHAR(8) NOT NULL,
    "nombre" TEXT NOT NULL,
    "flat" DECIMAL(5,2) NOT NULL,
    "piso" INTEGER NOT NULL,

    CONSTRAINT "departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectura" (
    "id" TEXT NOT NULL,
    "mes" VARCHAR(7) NOT NULL,
    "dptoId" VARCHAR(8) NOT NULL,
    "valor" DECIMAL(10,3) NOT NULL,
    "registradoPor" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibo" (
    "id" TEXT NOT NULL,
    "mes" VARCHAR(7) NOT NULL,
    "aguaM3" INTEGER NOT NULL,
    "aguaMonto" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2),
    "luz" DECIMAL(10,2) NOT NULL,
    "registradoPor" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto_fijo" (
    "id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(10,2),
    "anual" BOOLEAN NOT NULL DEFAULT false,
    "vigenteDesde" VARCHAR(7) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gasto_fijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto_extra" (
    "id" TEXT NOT NULL,
    "mes" VARCHAR(7) NOT NULL,
    "tipo" "tipo_extra" NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "dptoId" VARCHAR(8),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gasto_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reasignacion_agua" (
    "id" TEXT NOT NULL,
    "dptoId" VARCHAR(8) NOT NULL,
    "concepto" TEXT NOT NULL,
    "m3" DECIMAL(6,2) NOT NULL,
    "desde" VARCHAR(7) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reasignacion_agua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reasignacion_activa_mes" (
    "id" TEXT NOT NULL,
    "reasignacionId" TEXT NOT NULL,
    "mes" VARCHAR(7) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reasignacion_activa_mes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" TEXT NOT NULL,
    "mes" VARCHAR(7) NOT NULL,
    "dptoId" VARCHAR(8) NOT NULL,
    "estado" "estado_pago" NOT NULL,
    "fecha" DATE NOT NULL,
    "operacion" TEXT,
    "texto" TEXT,
    "confirmadoPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre" (
    "id" TEXT NOT NULL,
    "mes" VARCHAR(7) NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "publicadoPor" TEXT,
    "publicadoEn" TIMESTAMP(3),
    "paso" INTEGER NOT NULL DEFAULT 0,
    "notaQuePaso" TEXT,
    "notaQueCambio" TEXT,
    "notaQuePendiente" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "instantanea" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cierre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "campo" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "mes" VARCHAR(7),

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviso" (
    "id" TEXT NOT NULL,
    "tipo" "tipo_aviso" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "mes" VARCHAR(7),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviso_leido" (
    "id" TEXT NOT NULL,
    "avisoId" TEXT NOT NULL,
    "dptoId" VARCHAR(8) NOT NULL,
    "leidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_leido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_edificio" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "saldoInicial" DECIMAL(12,2) NOT NULL,
    "mesInicial" VARCHAR(7) NOT NULL,
    "bancoNombre" TEXT NOT NULL,
    "bancoCuenta" TEXT NOT NULL,
    "bancoCci" TEXT NOT NULL,
    "bancoTitular" TEXT NOT NULL,
    "diaVencimiento" INTEGER NOT NULL DEFAULT 10,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_edificio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intento_pin" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acertado" BOOLEAN NOT NULL,

    CONSTRAINT "intento_pin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lectura_mes_idx" ON "lectura"("mes");

-- CreateIndex
CREATE UNIQUE INDEX "lectura_mes_dptoId_key" ON "lectura"("mes", "dptoId");

-- CreateIndex
CREATE UNIQUE INDEX "recibo_mes_key" ON "recibo"("mes");

-- CreateIndex
CREATE INDEX "gasto_fijo_vigenteDesde_idx" ON "gasto_fijo"("vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "gasto_fijo_concepto_vigenteDesde_key" ON "gasto_fijo"("concepto", "vigenteDesde");

-- CreateIndex
CREATE INDEX "gasto_extra_mes_idx" ON "gasto_extra"("mes");

-- CreateIndex
CREATE UNIQUE INDEX "reasignacion_agua_dptoId_concepto_key" ON "reasignacion_agua"("dptoId", "concepto");

-- CreateIndex
CREATE INDEX "reasignacion_activa_mes_mes_idx" ON "reasignacion_activa_mes"("mes");

-- CreateIndex
CREATE UNIQUE INDEX "reasignacion_activa_mes_reasignacionId_mes_key" ON "reasignacion_activa_mes"("reasignacionId", "mes");

-- CreateIndex
CREATE INDEX "pago_mes_idx" ON "pago"("mes");

-- CreateIndex
CREATE UNIQUE INDEX "pago_mes_dptoId_key" ON "pago"("mes", "dptoId");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_mes_key" ON "cierre"("mes");

-- CreateIndex
CREATE INDEX "auditoria_mes_idx" ON "auditoria"("mes");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidadId_idx" ON "auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "auditoria_momento_idx" ON "auditoria"("momento");

-- CreateIndex
CREATE INDEX "aviso_creadoEn_idx" ON "aviso"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "aviso_leido_avisoId_dptoId_key" ON "aviso_leido"("avisoId", "dptoId");

-- CreateIndex
CREATE INDEX "intento_pin_ip_momento_idx" ON "intento_pin"("ip", "momento");

-- AddForeignKey
ALTER TABLE "lectura" ADD CONSTRAINT "lectura_dptoId_fkey" FOREIGN KEY ("dptoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_extra" ADD CONSTRAINT "gasto_extra_dptoId_fkey" FOREIGN KEY ("dptoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignacion_agua" ADD CONSTRAINT "reasignacion_agua_dptoId_fkey" FOREIGN KEY ("dptoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignacion_activa_mes" ADD CONSTRAINT "reasignacion_activa_mes_reasignacionId_fkey" FOREIGN KEY ("reasignacionId") REFERENCES "reasignacion_agua"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_dptoId_fkey" FOREIGN KEY ("dptoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso_leido" ADD CONSTRAINT "aviso_leido_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "aviso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso_leido" ADD CONSTRAINT "aviso_leido_dptoId_fkey" FOREIGN KEY ("dptoId") REFERENCES "departamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
