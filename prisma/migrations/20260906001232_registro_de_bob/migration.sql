-- CreateTable
CREATE TABLE "consulta_bob" (
    "id" TEXT NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dpto" VARCHAR(3),
    "mes" VARCHAR(7) NOT NULL,
    "esAdmin" BOOLEAN NOT NULL DEFAULT false,
    "pregunta" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "modo" VARCHAR(16) NOT NULL,
    "motivoCaida" VARCHAR(24),
    "llamadas" JSONB NOT NULL,
    "ms" INTEGER NOT NULL,

    CONSTRAINT "consulta_bob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consulta_bob_momento_idx" ON "consulta_bob"("momento");

-- CreateIndex
CREATE INDEX "consulta_bob_dpto_momento_idx" ON "consulta_bob"("dpto", "momento");
