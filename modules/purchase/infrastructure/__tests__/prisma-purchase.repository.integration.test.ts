import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaPurchaseRepository } from "../prisma-purchase.repository";

/**
 * Postgres-real integration test for PrismaPurchaseRepository (POC #11.0b A3
 * Ciclo 3). Mirror simétrico de `prisma-sale.repository.integration.test.ts`
 * + asimetrías purchase (4 purchaseTypes, 17 detail cols, 5 pfSummary header,
 * 4 purchase-specific header `ruta/farmOrigin/chickenCount/shrinkagePct`,
 * scoped sequence audit-4 D-A3-1, filter `purchaseType` audit-5 D-A3-2).
 *
 * Fixtures (`beforeAll`): User + Organization + FiscalPeriod + Contact
 * (PROVEEDOR — asimetría vs sale CLIENTE). ProductType + expense Account se
 * agregarán cuando los cycles 3+ los requieran (POLLO_FAENADO + COMPRA_GENERAL).
 *
 * §13 emergente locked Marco mirror sale C3: Prisma directo (Opción β) — adapter
 * NO wrap-thin shim sobre legacy. Mirror behavior legacy bit-exact via Prisma
 * queries directas sobre `Pick<PrismaClient, "purchase" | "purchaseDetail">`.
 *
 * D-A3-1 audit-4 locked: getNextSequenceNumberTx scoped por (organizationId,
 * purchaseType) — paridad legacy `features/purchase/purchase.repository.ts:163-172`
 * + schema `@@unique([organizationId, purchaseType, sequenceNumber])`.
 */

describe("PrismaPurchaseRepository — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `ppr-test-clerk-user-${stamp}`,
        email: `ppr-test-${stamp}@test.local`,
        name: "PrismaPurchaseRepository Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `ppr-test-clerk-org-${stamp}`,
        name: `PrismaPurchaseRepository Integration Test Org ${stamp}`,
        slug: `ppr-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "ppr-integration-period",
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
    // Aislamiento entre tests del mismo describe — child antes de padre por
    // FK Cascade safety + paralelo sale C3 pattern.
    await prisma.purchaseDetail.deleteMany({
      where: { purchase: { organizationId: testOrgId } },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    // FK-safe order, child→parent en cascada, paso 3 obligatorio:
    //   1. purchase_details (defensa explícita; Cascade existe pero paralelo
    //      sale C3 pattern por consistencia)
    //   2. purchases
    //   3. contacts
    //   4. fiscal_periods
    //   5. audit_logs (paso 3 — captura audit_purchases + audit_purchase_details)
    //   6. organization
    //   7. user
    await prisma.purchaseDetail.deleteMany({
      where: { purchase: { organizationId: testOrgId } },
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

  async function seedPurchaseDirect(
    status: "DRAFT" | "POSTED",
    sequenceNumber: number,
    purchaseType: "FLETE" | "POLLO_FAENADO" | "COMPRA_GENERAL" | "SERVICIO" = "FLETE",
    detailsCount = 2,
  ): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.purchase.create({
      data: {
        id,
        organizationId: testOrgId,
        purchaseType,
        status,
        sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "seeded purchase",
        totalAmount: new Prisma.Decimal(detailsCount * 100),
        createdById: testUserId,
        details: {
          create: Array.from({ length: detailsCount }, (_, i) => ({
            description: `seeded line ${i + 1}`,
            lineAmount: new Prisma.Decimal(100),
            order: i,
          })),
        },
      },
    });
    return id;
  }

  // ── Tests ───────────────────────────────────────────────────────────────

  it("findById: hit returns Purchase aggregate with details hydrated and payable null", async () => {
    // RED honesty preventivo: pre-GREEN FAILS por module resolution failure
    // (`../prisma-purchase.repository` no existe). Post-GREEN: PASSES porque
    // adapter lee row + details ordenados (orderBy:order asc) y retorna
    // Purchase.fromPersistence con array hidratado + `payable: null` (mirror
    // sale `receivable: null` — repo no cruza boundary payables).
    const id = await seedPurchaseDirect("DRAFT", 0, "FLETE", 3);
    const repo = new PrismaPurchaseRepository();

    const result = await repo.findById(testOrgId, id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
    expect(result!.organizationId).toBe(testOrgId);
    expect(result!.purchaseType).toBe("FLETE");
    expect(result!.status).toBe("DRAFT");
    expect(result!.details).toHaveLength(3);
    expect(result!.details[0].order).toBe(0);
    expect(result!.details[0].lineAmount.value).toBe(100);
    expect(result!.payable).toBeNull();
  });

  it("findById: miss orgId mismatch returns null", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: scope
    // por organizationId rechaza row de otro org (asserción cross-tenant).
    const id = await seedPurchaseDirect("DRAFT", 0);
    const repo = new PrismaPurchaseRepository();

    const result = await repo.findById("other-org-id", id);

    expect(result).toBeNull();
  });

  it("findByIdTx: hit inside $transaction returns Purchase aggregate", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // tx-bound (constructor con tx) lee dentro de la transacción abierta.
    const id = await seedPurchaseDirect("DRAFT", 0);

    const result = await prisma.$transaction(async (tx) => {
      const repo = new PrismaPurchaseRepository(tx);
      return repo.findByIdTx(testOrgId, id);
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
  });

  it("findAll: no filters returns all purchases for org", async () => {
    // RED honesty preventivo: pre-GREEN FAILS por stub `findAll` throw
    // "Not implemented yet — pending Cycle 2". Post-GREEN: list por
    // organizationId sin filtros adicionales, orderBy createdAt desc.
    await seedPurchaseDirect("DRAFT", 0);
    await seedPurchaseDirect("POSTED", 1);
    const repo = new PrismaPurchaseRepository();

    const result = await repo.findAll(testOrgId);

    expect(result).toHaveLength(2);
  });

  it("findAll: filters status + contactId + dateFrom narrow correctly", async () => {
    // RED honesty: pre-GREEN stub throw. Post-GREEN: WHERE compone status +
    // contactId + date.gte como legacy `features/purchase/purchase.repository.ts:124-133`.
    await seedPurchaseDirect("DRAFT", 0);
    await seedPurchaseDirect("POSTED", 1);
    const repo = new PrismaPurchaseRepository();

    const result = await repo.findAll(testOrgId, {
      status: "POSTED",
      contactId: testContactId,
      dateFrom: new Date("2099-01-01T00:00:00Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("POSTED");
  });

  it("findAll: filter purchaseType narrows FLETE-only when COMPRA_GENERAL also present (audit-5 D-A3-2)", async () => {
    // RED honesty: pre-GREEN stub throw. Post-GREEN: asimetría purchase vs
    // sale-hex — `PurchaseFilters.purchaseType?` extension audit-5 funcional
    // (consumer real `app/api/.../purchases/route.ts:23`). WHERE include
    // `purchaseType` cuando filter setteado, paralelo legacy `:124`.
    await seedPurchaseDirect("DRAFT", 0, "FLETE");
    await seedPurchaseDirect("POSTED", 1, "COMPRA_GENERAL");
    const repo = new PrismaPurchaseRepository();

    const result = await repo.findAll(testOrgId, { purchaseType: "FLETE" });

    expect(result).toHaveLength(1);
    expect(result[0].purchaseType).toBe("FLETE");
  });
});
