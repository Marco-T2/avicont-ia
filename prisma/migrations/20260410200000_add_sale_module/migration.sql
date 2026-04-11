-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'POSTED', 'LOCKED', 'VOIDED');

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "sequenceNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceNumber" INTEGER,
    "notes" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "receivableId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_details" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lineAmount" DECIMAL(12,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(12,4),
    "unitPrice" DECIMAL(12,4),
    "incomeAccountId" TEXT NOT NULL,

    CONSTRAINT "sale_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_journalEntryId_key" ON "sales"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receivableId_key" ON "sales"("receivableId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_organizationId_sequenceNumber_key" ON "sales"("organizationId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "sales_organizationId_status_idx" ON "sales"("organizationId", "status");

-- CreateIndex
CREATE INDEX "sales_organizationId_contactId_idx" ON "sales"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "sales_organizationId_date_idx" ON "sales"("organizationId", "date");

-- CreateIndex
CREATE INDEX "sale_details_saleId_idx" ON "sale_details"("saleId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit trigger for sales (reuses existing audit_trigger_fn)
CREATE TRIGGER audit_sales
  AFTER UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
