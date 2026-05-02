import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaIvaBookReaderAdapter } from "../prisma-iva-book-reader.adapter";

/**
 * Postgres-real integration test for PrismaIvaBookReaderAdapter
 * (POC #11.0b A3 Ciclo 5a). Mirror sale 5a bit-exact + asimetrías purchase:
 * - contact type PROVEEDOR (vs CLIENTE)
 * - Purchase fixture con purchaseType="FLETE" (audit-4 D-A3-1)
 * - tabla `iva_purchase_books` (vs `iva_sales_books`), col `purchaseId` (vs saleId)
 * - schema IvaPurchaseBook tiene `nitProveedor` (vs nitCliente) y NO tiene
 *   `estadoSIN` (sale-only). `tipoCompra Int @default(1)` aplica default,
 *   no se setea en fixture.
 * - audit_logs paso 3 cleanup obligatorio: audit_purchases trigger captura
 *   inserts Purchase fixture (paralelo C3). iva_purchase_books NO tiene
 *   audit trigger (verified migration 20260415031853_add_iva_books).
 *
 * §13 emergente E-5.d-purchase locked Marco: Opción β Prisma directo (NO
 * wrap-thin shim). Razón: no existe método legacy análogo `findByPurchaseId`
 * en `IvaBooksRepository`. Adapter usa `Pick<PrismaClient, "ivaPurchaseBook">`
 * .findUnique({where:{purchaseId}}) — purchaseId @unique global (schema L987).
 * Filter `status === "ACTIVE"` post-call mirror legacy
 * `extractIvaBookForEntry:131` (regla #1 fidelidad bit-exact). (Legacy
 * `IvaBooksService` y `IvaBooksRepository` deleted POC siguiente A2-C3, engram
 * `poc-siguiente/a2/c3/closed` — adapter Prisma directo permanece como
 * implementación final hex.)
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
        clerkUserId: `pibrp-test-clerk-user-${stamp}`,
        email: `pibrp-test-${stamp}@test.local`,
        name: "PrismaIvaBookReaderAdapter Purchase Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pibrp-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookReaderAdapter Purchase Integration Test Org ${stamp}`,
        slug: `pibrp-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pibrp-integration-period",
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
        name: "Test Supplier",
        type: "PROVEEDOR",
        nit: "9999999",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Aislamiento: child antes de padre (FK-safe). purchaseId @unique → 1
    // IvaPurchaseBook máximo por Purchase, deleteMany por org limpia ambos.
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    // FK-safe order. audit_logs paso 3 obligatorio: audit_purchases trigger
    // captura inserts Purchase fixture (paralelo C3 pattern).
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function seedPurchaseDirect(sequenceNumber: number): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.purchase.create({
      data: {
        id,
        organizationId: testOrgId,
        purchaseType: "FLETE",
        status: "DRAFT",
        sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "pibrp seeded purchase",
        totalAmount: new Prisma.Decimal("120.50"),
        createdById: testUserId,
      },
    });
    return id;
  }

  async function seedIvaPurchaseBook(opts: {
    purchaseId: string;
    status: "ACTIVE" | "VOIDED";
    sequenceTag: string;
    baseIvaSujetoCf?: string;
    dfCfIva?: string;
    tasaIva?: string;
    exentos?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.ivaPurchaseBook.create({
      data: {
        id,
        organizationId: testOrgId,
        fiscalPeriodId: testPeriodId,
        purchaseId: opts.purchaseId,
        fechaFactura: new Date("2099-01-15T12:00:00Z"),
        nitProveedor: "9999999",
        razonSocial: "Test Supplier",
        numeroFactura: `pibrp-${opts.sequenceTag}`,
        codigoAutorizacion: `pibrp-auth-${opts.sequenceTag}`,
        baseIvaSujetoCf: new Prisma.Decimal(opts.baseIvaSujetoCf ?? "0"),
        dfCfIva: new Prisma.Decimal(opts.dfCfIva ?? "0"),
        tasaIva: new Prisma.Decimal(opts.tasaIva ?? "0.1300"),
        exentos: new Prisma.Decimal(opts.exentos ?? "0"),
        status: opts.status,
      },
    });
    return id;
  }

  it("getActiveBookForPurchase: ACTIVE book — returns snapshot with bit-exact field mapping", async () => {
    // RED honesty preventivo (feedback/red-acceptance-failure-mode):
    // Pre-GREEN: stub `Cycle 5a — Not implemented yet` retorna null
    // hardcoded. FAILS este escenario por `expect(result).not.toBeNull()`.
    // Escenarios (2)(3) PASAN coincidentemente (stub también retorna null).
    // Post-GREEN: adapter delega a `prisma.ivaPurchaseBook.findUnique({
    // where:{purchaseId}})` y narrow al shape `IvaBookSnapshot` (mirror
    // legacy `extractIvaBookForEntry:132-137` mapping).
    //
    // Discriminantes elegidos para detectar mapping cruzado (mirror sale 5a):
    //   tasaIva=0.1300, dfCfIva=13.50, baseIvaSujetoCf=100.00, exentos=7.77.
    // Si el adapter cruzara campos (e.g. ivaAmount ← baseIvaSujetoCf), los
    // asserts numéricos detectarían valores intercambiados.
    const purchaseId = await seedPurchaseDirect(1);
    const ivaBookId = await seedIvaPurchaseBook({
      purchaseId,
      status: "ACTIVE",
      sequenceTag: "active",
      baseIvaSujetoCf: "100.00",
      dfCfIva: "13.50",
      tasaIva: "0.1300",
      exentos: "7.77",
    });

    const adapter = new PrismaIvaBookReaderAdapter(prisma);

    const result = await adapter.getActiveBookForPurchase(testOrgId, purchaseId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(ivaBookId);
    expect(result!.purchaseId).toBe(purchaseId);
    expect(result!.ivaRate).toBe(0.13);
    expect(result!.ivaAmount).toBe(13.5);
    expect(result!.netAmount).toBe(100);
    expect(result!.exentos).toBe(7.77);
  });

  it("getActiveBookForPurchase: no book exists for purchaseId — returns null", async () => {
    // RED honesty: stub retorna null hardcoded → PASS coincidente.
    // Post-GREEN: findUnique({where:{purchaseId}}) → null porque no hay row
    // con ese purchaseId. purchaseId arbitrario (no existe Purchase row
    // tampoco) — findUnique sólo mira `iva_purchase_books`, no FK Purchase.
    const adapter = new PrismaIvaBookReaderAdapter(prisma);

    const result = await adapter.getActiveBookForPurchase(
      testOrgId,
      "00000000-0000-0000-0000-000000000000",
    );

    expect(result).toBeNull();
  });

  it("getActiveBookForPurchase: VOIDED book — returns null (filter status === 'ACTIVE')", async () => {
    // RED honesty: stub retorna null hardcoded → PASS coincidente.
    // Post-GREEN: findUnique encuentra row, pero filter `status === "ACTIVE"`
    // descarta VOIDED → null (mirror legacy `extractIvaBookForEntry:131`).
    const purchaseId = await seedPurchaseDirect(2);
    await seedIvaPurchaseBook({
      purchaseId,
      status: "VOIDED",
      sequenceTag: "voided",
    });

    const adapter = new PrismaIvaBookReaderAdapter(prisma);

    const result = await adapter.getActiveBookForPurchase(testOrgId, purchaseId);

    expect(result).toBeNull();
  });
});
