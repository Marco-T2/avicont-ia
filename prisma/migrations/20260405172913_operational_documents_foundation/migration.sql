-- CreateEnum
CREATE TYPE "DispatchType" AS ENUM ('NOTA_DESPACHO', 'BOLETA_CERRADA');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayableStatus" ADD VALUE 'VOIDED';
ALTER TYPE "PayableStatus" ADD VALUE 'OVERDUE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReceivableStatus" ADD VALUE 'VOIDED';
ALTER TYPE "ReceivableStatus" ADD VALUE 'OVERDUE';

-- NOTE: Data migration (CANCELLED→VOIDED) removed from this migration.
-- PostgreSQL cannot use newly added enum values in the same transaction.
-- If any rows have CANCELLED status, run a separate migration after this one:
--   UPDATE accounts_receivable SET status = 'VOIDED' WHERE status = 'CANCELLED';
--   UPDATE accounts_payable SET status = 'VOIDED' WHERE status = 'CANCELLED';

-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cajaGeneralAccountCode" TEXT NOT NULL DEFAULT '1.1.1.1',
    "bancoAccountCode" TEXT NOT NULL DEFAULT '1.1.2.1',
    "cxcAccountCode" TEXT NOT NULL DEFAULT '1.1.4.1',
    "cxpAccountCode" TEXT NOT NULL DEFAULT '2.1.1.1',
    "roundingThreshold" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dispatchType" "DispatchType" NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "sequenceNumber" INTEGER NOT NULL,
    "referenceNumber" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "farmOrigin" TEXT,
    "chickenCount" INTEGER,
    "shrinkagePct" DECIMAL(5,4),
    "avgKgPerChicken" DECIMAL(8,4),
    "shrinkageKg" DECIMAL(12,4),
    "shortageKg" DECIMAL(12,4),
    "realNetKg" DECIMAL(12,4),
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "receivableId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_details" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "lineAmount" DECIMAL(12,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dispatch_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "method" "PaymentMethod" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "referenceNumber" INTEGER,
    "receivableId" TEXT,
    "payableId" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_organizationId_key" ON "org_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_journalEntryId_key" ON "dispatches"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_receivableId_key" ON "dispatches"("receivableId");

-- CreateIndex
CREATE INDEX "dispatches_organizationId_status_idx" ON "dispatches"("organizationId", "status");

-- CreateIndex
CREATE INDEX "dispatches_organizationId_contactId_idx" ON "dispatches"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "dispatches_organizationId_date_idx" ON "dispatches"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_organizationId_dispatchType_sequenceNumber_key" ON "dispatches"("organizationId", "dispatchType", "sequenceNumber");

-- CreateIndex
CREATE INDEX "dispatch_details_dispatchId_idx" ON "dispatch_details"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receivableId_key" ON "payments"("receivableId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payableId_key" ON "payments"("payableId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_journalEntryId_key" ON "payments"("journalEntryId");

-- CreateIndex
CREATE INDEX "payments_organizationId_status_idx" ON "payments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "payments_organizationId_contactId_idx" ON "payments"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "payments_organizationId_date_idx" ON "payments"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_details" ADD CONSTRAINT "dispatch_details_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
