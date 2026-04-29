import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaIvaBookReaderAdapter } from "../prisma-iva-book-reader.adapter";

/**
 * Postgres-real integration test for PrismaIvaBookReaderAdapter
 * (POC #11.0a A3 Ciclo 5a). Same baseline pattern as POC #11.0a A3 Ciclo 3
 * (`prisma-sale.repository.integration.test.ts`) MINUS audit_logs paso 3:
 * `iva_sales_books` has no audit trigger (verified via grep migrations);
 * Sale fixture cleanup is FK-safe via afterAll, audit_sales trigger from
 * Ciclo 3 covers the Sale row inserts.
 *
 * §13 emergente E-5.d locked Marco: D-2 reshape Opción β Prisma directo
 * (NO wrap-thin shim sobre `IvaBooksService.findSaleById`). Razón: legacy
 * `findSaleById(orgId, id)` busca por `IvaSalesBook.id`, NO por `Sale.id`,
 * y no hay método público `findBySaleId` en `IvaBooksRepository`.
 * Adapter usa `Pick<PrismaClient, "ivaSalesBook">.findUnique({where:{saleId}})`
 * — saleId tiene @unique global en schema (line 1027). Filter `status ===
 * "ACTIVE"` post-call mirror legacy `extractIvaBookForEntry:131` (regla #1
 * fidelidad bit-exact).
 */

describe("PrismaIvaBookReaderAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pibr-test-clerk-user-${stamp}`,
        email: `pibr-test-${stamp}@test.local`,
        name: "PrismaIvaBookReaderAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pibr-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookReaderAdapter Integration Test Org ${stamp}`,
        slug: `pibr-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pibr-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Customer",
        type: "CLIENTE",
        nit: "1234567",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Aislamiento: child antes de padre (FK-safe). saleId @unique → 1 IvaSalesBook
    // máximo por Sale, deleteMany por org limpia ambos en cualquier orden.
    await prisma.ivaSalesBook.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    // FK-safe order. audit_logs paso 3 obligatorio: audit_sales trigger
    // captura los inserts de Sale fixtures (Ciclo 3 pattern).
    await prisma.ivaSalesBook.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function seedSaleDirect(sequenceNumber: number): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.sale.create({
      data: {
        id,
        organizationId: testOrgId,
        status: "DRAFT",
        sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "pibr seeded sale",
        totalAmount: new Prisma.Decimal("120.50"),
        createdById: testUserId,
      },
    });
    return id;
  }

  async function seedIvaSalesBook(opts: {
    saleId: string;
    status: "ACTIVE" | "VOIDED";
    sequenceTag: string;
    baseIvaSujetoCf?: string;
    dfCfIva?: string;
    tasaIva?: string;
    exentos?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.ivaSalesBook.create({
      data: {
        id,
        organizationId: testOrgId,
        fiscalPeriodId: testPeriodId,
        saleId: opts.saleId,
        fechaFactura: new Date("2099-01-15T12:00:00Z"),
        nitCliente: "1234567",
        razonSocial: "Test Customer",
        numeroFactura: `pibr-${opts.sequenceTag}`,
        codigoAutorizacion: `pibr-auth-${opts.sequenceTag}`,
        baseIvaSujetoCf: new Prisma.Decimal(opts.baseIvaSujetoCf ?? "0"),
        dfCfIva: new Prisma.Decimal(opts.dfCfIva ?? "0"),
        tasaIva: new Prisma.Decimal(opts.tasaIva ?? "0.1300"),
        exentos: new Prisma.Decimal(opts.exentos ?? "0"),
        estadoSIN: "V",
        status: opts.status,
      },
    });
    return id;
  }

  it("getActiveBookForSale: ACTIVE book — returns snapshot with bit-exact field mapping", async () => {
    // RED honesty preventivo (feedback/red-acceptance-failure-mode):
    // FAILS pre-implementación por module resolution failure
    // (`PrismaIvaBookReaderAdapter` no existe). Post-GREEN: PASSES porque
    // adapter delega a `prisma.ivaSalesBook.findUnique({where:{saleId}})`
    // y narrow al shape `IvaBookSnapshot` (mirror legacy
    // `extractIvaBookForEntry:132-137` mapping).
    //
    // Discriminantes elegidos para detectar mapping cruzado:
    //   tasaIva=0.1300, dfCfIva=13.50, baseIvaSujetoCf=100.00, exentos=7.77.
    // Si el adapter cruzara campos (e.g. ivaAmount ← baseIvaSujetoCf), los
    // asserts numéricos detectarían valores intercambiados.
    const saleId = await seedSaleDirect(1);
    const ivaBookId = await seedIvaSalesBook({
      saleId,
      status: "ACTIVE",
      sequenceTag: "active",
      baseIvaSujetoCf: "100.00",
      dfCfIva: "13.50",
      tasaIva: "0.1300",
      exentos: "7.77",
    });

    const adapter = new PrismaIvaBookReaderAdapter(prisma);

    const result = await adapter.getActiveBookForSale(testOrgId, saleId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(ivaBookId);
    expect(result!.saleId).toBe(saleId);
    expect(result!.ivaRate).toBe(0.13);
    expect(result!.ivaAmount).toBe(13.5);
    expect(result!.netAmount).toBe(100);
    expect(result!.exentos).toBe(7.77);
  });

  it("getActiveBookForSale: no book exists for saleId — returns null", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: findUnique({where:{saleId}}) → null porque no hay row con
    // ese saleId. saleId arbitrario (no existe Sale row tampoco) — findUnique
    // sólo mira `iva_sales_books`, no FK Sale.
    const adapter = new PrismaIvaBookReaderAdapter(prisma);

    const result = await adapter.getActiveBookForSale(
      testOrgId,
      "00000000-0000-0000-0000-000000000000",
    );

    expect(result).toBeNull();
  });

  it("getActiveBookForSale: VOIDED book — returns null (filter status === 'ACTIVE')", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: findUnique encuentra row, pero filter `status === "ACTIVE"`
    // descarta VOIDED → null (mirror legacy `extractIvaBookForEntry:131`).
    const saleId = await seedSaleDirect(2);
    await seedIvaSalesBook({
      saleId,
      status: "VOIDED",
      sequenceTag: "voided",
    });

    const adapter = new PrismaIvaBookReaderAdapter(prisma);

    const result = await adapter.getActiveBookForSale(testOrgId, saleId);

    expect(result).toBeNull();
  });
});
