-- CreateEnum
CREATE TYPE "IvaBookStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "IvaSalesEstadoSIN" AS ENUM ('A', 'V', 'C', 'L');

-- CreateTable
CREATE TABLE "iva_purchase_books" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "fechaFactura" TIMESTAMP(3) NOT NULL,
    "nitProveedor" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL,
    "codigoAutorizacion" TEXT NOT NULL,
    "codigoControl" TEXT NOT NULL DEFAULT '',
    "importeTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeIce" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeIehd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeIpj" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otrosNoSujetos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "exentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasaCero" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dfIva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "codigoDescuentoAdicional" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeGiftCard" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseIvaSujetoCf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dfCfIva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "tipoCompra" INTEGER NOT NULL DEFAULT 1,
    "status" "IvaBookStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iva_purchase_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iva_sales_books" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "saleId" TEXT,
    "fechaFactura" TIMESTAMP(3) NOT NULL,
    "nitCliente" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL,
    "codigoAutorizacion" TEXT NOT NULL,
    "codigoControl" TEXT NOT NULL DEFAULT '',
    "importeTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeIce" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeIehd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeIpj" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otrosNoSujetos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "exentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasaCero" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dfIva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "codigoDescuentoAdicional" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importeGiftCard" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseIvaSujetoCf" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dfCfIva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "estadoSIN" "IvaSalesEstadoSIN" NOT NULL,
    "status" "IvaBookStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iva_sales_books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iva_purchase_books_purchaseId_key" ON "iva_purchase_books"("purchaseId");

-- CreateIndex
CREATE INDEX "iva_purchase_books_organizationId_fiscalPeriodId_idx" ON "iva_purchase_books"("organizationId", "fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "iva_purchase_books_organizationId_nitProveedor_numeroFactur_key" ON "iva_purchase_books"("organizationId", "nitProveedor", "numeroFactura", "codigoAutorizacion");

-- CreateIndex
CREATE UNIQUE INDEX "iva_sales_books_saleId_key" ON "iva_sales_books"("saleId");

-- CreateIndex
CREATE INDEX "iva_sales_books_organizationId_fiscalPeriodId_idx" ON "iva_sales_books"("organizationId", "fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "iva_sales_books_organizationId_numeroFactura_codigoAutoriza_key" ON "iva_sales_books"("organizationId", "numeroFactura", "codigoAutorizacion");

-- AddForeignKey
ALTER TABLE "iva_purchase_books" ADD CONSTRAINT "iva_purchase_books_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_purchase_books" ADD CONSTRAINT "iva_purchase_books_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_purchase_books" ADD CONSTRAINT "iva_purchase_books_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_sales_books" ADD CONSTRAINT "iva_sales_books_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_sales_books" ADD CONSTRAINT "iva_sales_books_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_sales_books" ADD CONSTRAINT "iva_sales_books_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
