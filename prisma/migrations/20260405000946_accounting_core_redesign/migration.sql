/*
  Warnings:

  - You are about to drop the column `voucherType` on the `journal_entries` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,voucherTypeId,periodId,number]` on the table `journal_entries` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nature` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodId` to the `journal_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `journal_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `voucherTypeId` to the `journal_entries` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('DEUDORA', 'ACREEDORA');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "VoucherTypeCode" AS ENUM ('CI', 'CE', 'CD', 'CT', 'CA');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- DropIndex
DROP INDEX "journal_entries_organizationId_number_key";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isDetail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nature" "AccountNature" NOT NULL,
ADD COLUMN     "requiresContact" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "journal_entries" DROP COLUMN "voucherType",
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "periodId" TEXT NOT NULL,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "voucherTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "journal_lines" ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "VoucherType";

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" "VoucherTypeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "voucher_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "debitTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_periods_organizationId_status_idx" ON "fiscal_periods"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_organizationId_year_key" ON "fiscal_periods"("organizationId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_types_organizationId_code_key" ON "voucher_types"("organizationId", "code");

-- CreateIndex
CREATE INDEX "account_balances_organizationId_periodId_idx" ON "account_balances"("organizationId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_accountId_periodId_key" ON "account_balances"("accountId", "periodId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_periodId_idx" ON "journal_entries"("organizationId", "periodId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_status_idx" ON "journal_entries"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organizationId_voucherTypeId_periodId_numbe_key" ON "journal_entries"("organizationId", "voucherTypeId", "periodId", "number");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_voucherTypeId_fkey" FOREIGN KEY ("voucherTypeId") REFERENCES "voucher_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_types" ADD CONSTRAINT "voucher_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
