-- Allocation-target generalization for CreditConsumption (PAGO credit system).
-- Mirrors PaymentAllocation: a credit link targets EITHER a receivable (COBRO)
-- OR a payable (PAGO), XOR. Additive + nullability-relax only:
--   * receivableId: DROP NOT NULL (legacy receivable-only rows stay valid, payableId null)
--   * payableId: ADD COLUMN (nullable) + FK to accounts_payable + index
-- NO SQL CHECK constraint — the XOR is enforced by the AllocationTarget VO + Zod,
-- exactly as PaymentAllocation does (design D2). No data backfill.
-- The receivableId FK is recreated with ON DELETE SET NULL (was RESTRICT) to match
-- the nullable-FK convention used by payment_allocations (20260405215800).
--
-- R-6 SAFETY: generated with --create-only and reviewed manually. Prisma's
-- auto-generated diff also emitted UNRELATED journal_entries index drift
-- (DropIndex/RenameIndex on voucherType/operationalDocType indexes); those were
-- REMOVED to isolate this change — same isolation discipline applied to the
-- preceding 20260523033337_add_credit_consumption migration.

-- DropForeignKey
ALTER TABLE "credit_consumptions" DROP CONSTRAINT "credit_consumptions_receivableId_fkey";

-- AlterTable
ALTER TABLE "credit_consumptions" ADD COLUMN     "payableId" TEXT,
ALTER COLUMN "receivableId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "credit_consumptions_payableId_idx" ON "credit_consumptions"("payableId");

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_consumptions" ADD CONSTRAINT "credit_consumptions_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
