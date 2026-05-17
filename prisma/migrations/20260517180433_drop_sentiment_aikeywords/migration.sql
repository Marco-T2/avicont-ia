/*
  Warnings:

  - You are about to drop the column `aiKeywords` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `sentiment` on the `documents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "documents" DROP COLUMN "aiKeywords",
DROP COLUMN "sentiment";
