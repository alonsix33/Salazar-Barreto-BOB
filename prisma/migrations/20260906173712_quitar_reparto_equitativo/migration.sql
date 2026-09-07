/*
  Warnings:

  - You are about to drop the column `participantes` on the `gasto_extra` table. All the data in the column will be lost.
  - You are about to drop the column `reparto` on the `gasto_extra` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "gasto_extra" DROP COLUMN "participantes",
DROP COLUMN "reparto";

-- DropEnum
DROP TYPE "reparto_extra";
