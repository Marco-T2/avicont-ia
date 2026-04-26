-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "aiOriginalText" TEXT;

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "defaultBankAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "defaultCashAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
