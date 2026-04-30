import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaIvaBookVoidCascadeAdapter } from "../prisma-iva-book-void-cascade.adapter";

/**
 * Postgres-real integration test for PrismaIvaBookVoidCascadeAdapter
 * (POC #11.0b A3 Ciclo 5b). Mirror sale 5b bit-exact + asimetrías purchase:
 * - contact type PROVEEDOR (vs CLIENTE)
 * - Purchase fixture con purchaseType="FLETE" (audit-4 D-A3-1)
 * - tabla `iva_purchase_books` (vs `iva_sales_books`), col `purchaseId` (vs saleId)
 * - schema IvaPurchaseBook tiene `nitProveedor` y NO tiene `estadoSIN`
 *   (sale-only)
 * - audit_logs paso 3 cleanup obligatorio: audit_purchases trigger captura
 *   inserts Purchase fixture. iva_purchase_books NO tiene audit trigger.
 *
 * Tx-bound write port: adapter recibe `Prisma.TransactionClient` por c2 DI
 * vía PurchaseScope (C6). Tests ejecutan `prisma.$transaction(async (tx) =>
 * { ... })` y verifican post-commit reading via top-level prisma.
 *
 * Opción β Prisma directo lockeada (mirror sale 5b §13 E-5.a): mirror exacto
 * `voidCascadeTx purchase.service.ts:1361-1367` legacy —
 * `IvaBooksService.markVoidedFromPurchase` NO existe (legacy escribe directo
 * en cascade purchase-side). Retirada §5.5 — POC #11.0c.
 *
 * Paridad regla #1: `findUnique({where:{purchaseId}})` SIN filter
 * `organizationId` (mirror legacy bit-exact `:1361`). `_organizationId`
 * queda anotado como D1 drift candidate paralelo D2 para auditoría POC
 * #11.0b end (mirror sale 5b D1 label).
 */

describe("PrismaIvaBookVoidCascadeAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pivcp-test-clerk-user-${stamp}`,
        email: `pivcp-test-${stamp}@test.local`,
        name: "PrismaIvaBookVoidCascadeAdapter Purchase Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pivcp-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookVoidCascadeAdapter Purchase Integration Test Org ${stamp}`,
        slug: `pivcp-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pivcp-integration-period",
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
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
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
        description: "pivcp seeded purchase",
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
        numeroFactura: `pivcp-${opts.sequenceTag}`,
        codigoAutorizacion: `pivcp-auth-${opts.sequenceTag}`,
        status: opts.status,
      },
    });
    return id;
  }

  it("markVoidedFromPurchase: ACTIVE book exists — updates status to VOIDED", async () => {
    // RED honesty preventivo (feedback/red-acceptance-failure-mode):
    // Pre-GREEN: stub no-op deja la row ACTIVE intacta. FAILS este escenario
    // por `expect(post!.status).toBe("VOIDED")` — row sigue ACTIVE.
    // Escenarios (2)(3) PASAN coincidentemente (stub no-op = sin write side
    // effect). Post-GREEN: adapter ejecuta `tx.ivaPurchaseBook.update({
    // where:{id}, data:{status:"VOIDED"}})` (mirror legacy
    // `voidCascadeTx purchase.service.ts:1363-1366`).
    const purchaseId = await seedPurchaseDirect(1);
    const ivaBookId = await seedIvaPurchaseBook({
      purchaseId,
      status: "ACTIVE",
      sequenceTag: "active",
    });

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookVoidCascadeAdapter(tx);
      await adapter.markVoidedFromPurchase(testOrgId, purchaseId);
    });

    const post = await prisma.ivaPurchaseBook.findUnique({
      where: { id: ivaBookId },
    });
    expect(post).not.toBeNull();
    expect(post!.status).toBe("VOIDED");
  });

  it("markVoidedFromPurchase: already VOIDED book — no-op (no update side-effect)", async () => {
    // RED honesty: stub no-op → PASS coincidente (status sigue VOIDED, sin
    // write → updatedAt no muta). Post-GREEN: adapter chequea
    // `if (ivaBook && ivaBook.status !== "VOIDED")` y skip-update (mirror
    // legacy `voidCascadeTx purchase.service.ts:1362`). Verificación:
    // `updatedAt` pre-call === post-call (Prisma `@updatedAt` muta solo
    // cuando hay write).
    const purchaseId = await seedPurchaseDirect(2);
    const ivaBookId = await seedIvaPurchaseBook({
      purchaseId,
      status: "VOIDED",
      sequenceTag: "voided",
    });
    const pre = await prisma.ivaPurchaseBook.findUnique({
      where: { id: ivaBookId },
    });
    const preUpdatedAt = pre!.updatedAt.getTime();

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookVoidCascadeAdapter(tx);
      await adapter.markVoidedFromPurchase(testOrgId, purchaseId);
    });

    const post = await prisma.ivaPurchaseBook.findUnique({
      where: { id: ivaBookId },
    });
    expect(post!.status).toBe("VOIDED");
    expect(post!.updatedAt.getTime()).toBe(preUpdatedAt);
  });

  it("markVoidedFromPurchase: no book exists for purchaseId — no-op (no error, no insert)", async () => {
    // RED honesty: stub no-op → PASS coincidente (count sigue 0).
    // Post-GREEN: findUnique → null → adapter skip-update (mirror legacy
    // `voidCascadeTx purchase.service.ts:1361-1362` `if (ivaBook && ...)`).
    // Sin throw, sin insert side-effect.
    const arbitraryPurchaseId = "00000000-0000-0000-0000-000000000000";

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookVoidCascadeAdapter(tx);
      await adapter.markVoidedFromPurchase(testOrgId, arbitraryPurchaseId);
    });

    const count = await prisma.ivaPurchaseBook.count({
      where: { organizationId: testOrgId },
    });
    expect(count).toBe(0);
  });
});
