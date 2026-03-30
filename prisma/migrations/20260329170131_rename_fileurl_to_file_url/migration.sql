/*
  Warnings:

  - You are about to drop the column `fileurl` on the `documents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "documents" DROP COLUMN "fileurl",
ADD COLUMN     "fileUrl" TEXT;
