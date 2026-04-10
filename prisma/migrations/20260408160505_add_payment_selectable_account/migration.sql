-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "bankParentCode" TEXT NOT NULL DEFAULT '1.1.3',
ADD COLUMN     "cashParentCode" TEXT NOT NULL DEFAULT '1.1.1',
ADD COLUMN     "pettyCashParentCode" TEXT NOT NULL DEFAULT '1.1.2';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "accountCode" TEXT;
