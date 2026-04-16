-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "itExpenseAccountCode" TEXT NOT NULL DEFAULT '5.3.3',
ADD COLUMN     "itPayableAccountCode" TEXT NOT NULL DEFAULT '2.1.7';
