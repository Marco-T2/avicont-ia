/*
  Warnings:

  - You are about to drop the column `quantity` on the `dispatch_details` table. All the data in the column will be lost.
  - You are about to drop the column `realNetKg` on the `dispatches` table. All the data in the column will be lost.
  - You are about to drop the column `shortageKg` on the `dispatches` table. All the data in the column will be lost.
  - You are about to drop the column `shrinkageKg` on the `dispatches` table. All the data in the column will be lost.
  - You are about to alter the column `shrinkagePct` on the `dispatches` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,4)` to `Decimal(5,2)`.
  - Added the required column `boxes` to the `dispatch_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossWeight` to the `dispatch_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `netWeight` to the `dispatch_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tare` to the `dispatch_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dispatch_details" DROP COLUMN "quantity",
ADD COLUMN     "boxes" INTEGER NOT NULL,
ADD COLUMN     "grossWeight" DECIMAL(12,4) NOT NULL,
ADD COLUMN     "netWeight" DECIMAL(12,4) NOT NULL,
ADD COLUMN     "realNetWeight" DECIMAL(12,4),
ADD COLUMN     "shortage" DECIMAL(12,4),
ADD COLUMN     "shrinkage" DECIMAL(12,4),
ADD COLUMN     "tare" DECIMAL(12,4) NOT NULL;

-- AlterTable
ALTER TABLE "dispatches" DROP COLUMN "realNetKg",
DROP COLUMN "shortageKg",
DROP COLUMN "shrinkageKg",
ADD COLUMN     "totalGrossKg" DECIMAL(12,4),
ADD COLUMN     "totalNetKg" DECIMAL(12,4),
ADD COLUMN     "totalRealNetKg" DECIMAL(12,4),
ADD COLUMN     "totalShortageKg" DECIMAL(12,4),
ADD COLUMN     "totalShrinkKg" DECIMAL(12,4),
ALTER COLUMN "shrinkagePct" SET DATA TYPE DECIMAL(5,2);
