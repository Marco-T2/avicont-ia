-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "organization_members_organizationId_deactivatedAt_idx" ON "organization_members"("organizationId", "deactivatedAt");
