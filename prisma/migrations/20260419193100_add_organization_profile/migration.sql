-- CreateEnum
CREATE TYPE "SignatureLabel" AS ENUM ('ELABORADO', 'APROBADO', 'VISTO_BUENO', 'PROPIETARIO', 'REVISADO', 'REGISTRADO', 'CONTABILIZADO');

-- CreateEnum
CREATE TYPE "DocumentPrintType" AS ENUM ('BALANCE_GENERAL', 'ESTADO_RESULTADOS', 'COMPROBANTE', 'DESPACHO', 'VENTA', 'COMPRA', 'COBRO', 'PAGO');

-- CreateTable
CREATE TABLE "org_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL DEFAULT '',
    "nit" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT NOT NULL DEFAULT '',
    "nroPatronal" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signature_config" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" "DocumentPrintType" NOT NULL,
    "labels" "SignatureLabel"[],
    "showReceiverRow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_signature_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_profile_organizationId_key" ON "org_profile"("organizationId");

-- CreateIndex
CREATE INDEX "document_signature_config_organizationId_idx" ON "document_signature_config"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "document_signature_config_organizationId_documentType_key" ON "document_signature_config"("organizationId", "documentType");

-- AddForeignKey
ALTER TABLE "org_profile" ADD CONSTRAINT "org_profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signature_config" ADD CONSTRAINT "document_signature_config_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
