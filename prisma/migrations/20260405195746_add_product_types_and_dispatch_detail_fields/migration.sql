-- AlterTable
ALTER TABLE "dispatch_details" ADD COLUMN     "detailNote" TEXT,
ADD COLUMN     "productTypeId" TEXT;

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_types_organizationId_isActive_idx" ON "product_types"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_organizationId_code_key" ON "product_types"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "dispatch_details" ADD CONSTRAINT "dispatch_details_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
