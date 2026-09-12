-- CreateEnum
CREATE TYPE "modo_reparto" AS ENUM ('porcentaje', 'iguales');

-- AlterTable
ALTER TABLE "gasto_extra" ADD COLUMN     "participantes" VARCHAR(8)[],
ADD COLUMN     "reparto" "modo_reparto" NOT NULL DEFAULT 'porcentaje';
