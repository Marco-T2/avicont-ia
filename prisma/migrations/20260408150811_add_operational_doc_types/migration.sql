-- CreateEnum
CREATE TYPE "OperationalDocDirection" AS ENUM ('COBRO', 'PAGO', 'BOTH');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "operationalDocTypeId" TEXT;

-- CreateTable
CREATE TABLE "operational_doc_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "OperationalDocDirection" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_doc_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_doc_types_organizationId_isActive_idx" ON "operational_doc_types"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "operational_doc_types_organizationId_code_key" ON "operational_doc_types"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_operationalDocTypeId_fkey" FOREIGN KEY ("operationalDocTypeId") REFERENCES "operational_doc_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_doc_types" ADD CONSTRAINT "operational_doc_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
