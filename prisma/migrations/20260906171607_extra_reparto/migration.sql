-- CreateEnum
CREATE TYPE "reparto_extra" AS ENUM ('flat', 'igual');

-- AlterTable
ALTER TABLE "gasto_extra" ADD COLUMN     "participantes" TEXT[],
ADD COLUMN     "reparto" "reparto_extra" NOT NULL DEFAULT 'flat';
