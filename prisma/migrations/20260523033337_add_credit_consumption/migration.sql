-- QB-style LinkedTxn: tabla puente consumidor↔fuente para crédito.
-- consumerPaymentId NULLABLE → soporta apply-credits standalone (sin pago consumidor).
-- R-6 SAFETY: migración generada con --create-only y revisada manualmente.
-- Verificado: NO contiene operaciones sobre dispatches ni su índice parcial
-- (dispatches_organizationId_dispatchType_sequenceNumber_key con WHERE status <> 'DRAFT').
-- Las operaciones de drift en journal_entries se eliminaron para aislar este cambio.

-- CreateTable
CREATE TABLE "credit_consumptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerPaymentId" TEXT,
    "sourcePaymentId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_consumptions_organizationId_consumerPaymentId_idx" ON "credit_consumptions"("organizationId", "consumerPaymentId");

-- CreateIndex
CREATE INDEX "credit_consumptions_organizationId_sourcePaymentId_idx" ON "credit_consumptions"("organizationId", "sourcePaymentId");

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_consumerPaymentId_fkey" FOREIGN KEY ("consumerPaymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
