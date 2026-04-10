/*
  Warnings:

  - You are about to drop the column `creditApplied` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the `credit_consumptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "credit_consumptions" DROP CONSTRAINT "credit_consumptions_consumerPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "credit_consumptions" DROP CONSTRAINT "credit_consumptions_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "credit_consumptions" DROP CONSTRAINT "credit_consumptions_sourcePaymentId_fkey";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "creditApplied";

-- DropTable
DROP TABLE "credit_consumptions";
