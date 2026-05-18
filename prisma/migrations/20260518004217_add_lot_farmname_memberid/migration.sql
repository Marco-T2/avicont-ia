-- AlterTable
ALTER TABLE "chicken_lots" ADD COLUMN     "farmName" TEXT,
ADD COLUMN     "memberId" TEXT;

-- CreateIndex
CREATE INDEX "chicken_lots_memberId_idx" ON "chicken_lots"("memberId");

-- AddForeignKey
ALTER TABLE "chicken_lots" ADD CONSTRAINT "chicken_lots_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "organization_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
