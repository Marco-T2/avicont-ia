-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "creditApplied" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "credit_consumptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerPaymentId" TEXT NOT NULL,
    "sourcePaymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_consumptions_consumerPaymentId_idx" ON "credit_consumptions"("consumerPaymentId");

-- CreateIndex
CREATE INDEX "credit_consumptions_sourcePaymentId_idx" ON "credit_consumptions"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "credit_consumptions_organizationId_idx" ON "credit_consumptions"("organizationId");

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_consumerPaymentId_fkey" FOREIGN KEY ("consumerPaymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
