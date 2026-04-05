-- CreateTable (before dropping old columns so we can migrate data)
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receivableId" TEXT,
    "payableId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_receivableId_idx" ON "payment_allocations"("receivableId");

-- CreateIndex
CREATE INDEX "payment_allocations_payableId_idx" ON "payment_allocations"("payableId");

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: move existing payment links to payment_allocations
INSERT INTO "payment_allocations" ("id", "paymentId", "receivableId", "payableId", "amount")
SELECT
    gen_random_uuid()::text,
    p."id",
    p."receivableId",
    NULL,
    p."amount"
FROM "payments" p
WHERE p."receivableId" IS NOT NULL;

INSERT INTO "payment_allocations" ("id", "paymentId", "receivableId", "payableId", "amount")
SELECT
    gen_random_uuid()::text,
    p."id",
    NULL,
    p."payableId",
    p."amount"
FROM "payments" p
WHERE p."payableId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_payableId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_receivableId_fkey";

-- DropIndex
DROP INDEX "payments_payableId_key";

-- DropIndex
DROP INDEX "payments_receivableId_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "payableId",
DROP COLUMN "receivableId";
