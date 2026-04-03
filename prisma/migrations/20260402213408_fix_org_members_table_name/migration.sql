/*
  Warnings:

  - You are about to drop the `organizations_members` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `name` on table `organizations` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "organizations_members" DROP CONSTRAINT "organizations_members_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organizations_members" DROP CONSTRAINT "organizations_members_userId_fkey";

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "name" SET NOT NULL;

-- DropTable
DROP TABLE "organizations_members";

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
