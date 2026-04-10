-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('FLETE', 'POLLO_FAENADO', 'COMPRA_GENERAL', 'SERVICIO');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'POSTED', 'LOCKED', 'VOIDED');

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "fleteExpenseAccountCode" TEXT NOT NULL DEFAULT '5.1.3',
ADD COLUMN     "polloFaenadoCOGSAccountCode" TEXT NOT NULL DEFAULT '5.1.1';

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseType" "PurchaseType" NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "sequenceNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceNumber" INTEGER,
    "notes" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ruta" TEXT,
    "farmOrigin" TEXT,
    "chickenCount" INTEGER,
    "shrinkagePct" DECIMAL(5,2),
    "totalGrossKg" DECIMAL(12,4),
    "totalNetKg" DECIMAL(12,4),
    "totalShrinkKg" DECIMAL(12,4),
    "totalShortageKg" DECIMAL(12,4),
    "totalRealNetKg" DECIMAL(12,4),
    "journalEntryId" TEXT,
    "payableId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_details" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lineAmount" DECIMAL(12,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3),
    "docRef" TEXT,
    "chickenQty" INTEGER,
    "pricePerChicken" DECIMAL(12,4),
    "productTypeId" TEXT,
    "detailNote" TEXT,
    "boxes" INTEGER,
    "grossWeight" DECIMAL(12,4),
    "tare" DECIMAL(12,4),
    "netWeight" DECIMAL(12,4),
    "unitPrice" DECIMAL(12,4),
    "shrinkage" DECIMAL(12,4),
    "shortage" DECIMAL(12,4),
    "realNetWeight" DECIMAL(12,4),
    "quantity" DECIMAL(12,4),
    "expenseAccountId" TEXT,

    CONSTRAINT "purchase_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_journalEntryId_key" ON "purchases"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_payableId_key" ON "purchases"("payableId");

-- CreateIndex
CREATE INDEX "purchases_organizationId_status_idx" ON "purchases"("organizationId", "status");

-- CreateIndex
CREATE INDEX "purchases_organizationId_contactId_idx" ON "purchases"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "purchases_organizationId_date_idx" ON "purchases"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_organizationId_purchaseType_sequenceNumber_key" ON "purchases"("organizationId", "purchaseType", "sequenceNumber");

-- CreateIndex
CREATE INDEX "purchase_details_purchaseId_idx" ON "purchase_details"("purchaseId");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_details" ADD CONSTRAINT "purchase_details_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_details" ADD CONSTRAINT "purchase_details_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_details" ADD CONSTRAINT "purchase_details_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
