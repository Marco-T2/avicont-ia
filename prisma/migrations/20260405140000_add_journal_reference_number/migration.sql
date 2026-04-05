-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN "referenceNumber" INTEGER;

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_voucherTypeId_referenceNumbe_idx" ON "journal_entries"("organizationId", "voucherTypeId", "referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organizationId_voucherTypeId_referenceNumbe_key" ON "journal_entries"("organizationId", "voucherTypeId", "referenceNumber");
