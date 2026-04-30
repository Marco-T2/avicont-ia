import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Purchase } from "@/modules/purchase/domain/purchase.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

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
  let testProductTypeId: string;

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

    const productType = await prisma.productType.create({
      data: {
        organizationId: testOrgId,
        name: "Test Pollo Vivo",
        code: "PV-01",
      },
    });
    testProductTypeId = productType.id;
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
    //   3. product_types (después de purchase_details — FK productTypeId)
    //   4. contacts
    //   5. fiscal_periods
    //   6. audit_logs (paso 3 — captura audit_purchases + audit_purchase_details)
    //   7. organization
    //   8. user
    await prisma.purchaseDetail.deleteMany({
      where: { purchase: { organizationId: testOrgId } },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.productType.deleteMany({ where: { organizationId: testOrgId } });
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

  it("saveTx: persists DRAFT FLETE with header (ruta) + details (chickenQty + pricePerChicken)", async () => {
    // RED honesty preventivo: pre-GREEN FAILS por stub `saveTx` throw "Not
    // implemented yet — pending Cycle 3". Post-GREEN: adapter INSERT row +
    // nested INSERT details, mirror legacy `create` (DRAFT path) + tx-bound.
    const draft = Purchase.createDraft({
      organizationId: testOrgId,
      purchaseType: "FLETE",
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T12:00:00Z"),
      description: "ppr integration FLETE draft",
      createdById: testUserId,
      ruta: "Ruta 1",
      details: [
        {
          description: "flete line 1",
          lineAmount: MonetaryAmount.of(100),
          order: 0,
          chickenQty: 50,
          pricePerChicken: 2,
        },
        {
          description: "flete line 2",
          lineAmount: MonetaryAmount.of(200),
          order: 1,
          chickenQty: 100,
          pricePerChicken: 2,
        },
      ],
    });
    const aggregateId = draft.id;

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaPurchaseRepository(tx);
      await repo.saveTx(draft);
    });

    const persisted = await prisma.purchase.findFirst({
      where: { id: aggregateId, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.purchaseType).toBe("FLETE");
    expect(persisted!.status).toBe("DRAFT");
    expect(persisted!.ruta).toBe("Ruta 1");
    expect(Number(persisted!.totalAmount)).toBe(300);
    expect(persisted!.details).toHaveLength(2);
    expect(persisted!.details[0].chickenQty).toBe(50);
    expect(Number(persisted!.details[0].pricePerChicken)).toBe(2);
  });

  it("saveTx: persists POSTED POLLO_FAENADO with pfSummary header + 17-col details + sequenceNumber + totalAmount", async () => {
    // RED honesty: pre-GREEN stub throw. Post-GREEN: adapter persiste status
    // POSTED + sequenceNumber>0 + totalAmount Decimal real + pfSummary 5
    // header cols + 4 purchase-specific header (farmOrigin/chickenCount/
    // shrinkagePct) + 17 detail cols (POLLO_FAENADO subset relevante:
    // productTypeId/detailNote/boxes/grossWeight/tare/netWeight/unitPrice/
    // shrinkage/shortage/realNetWeight). FLETE/COMPRA_GENERAL cols del detail
    // quedan null en este test.
    const draft = Purchase.createDraft({
      organizationId: testOrgId,
      purchaseType: "POLLO_FAENADO",
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T12:00:00Z"),
      description: "ppr integration POLLO_FAENADO draft",
      createdById: testUserId,
      farmOrigin: "Granja A",
      chickenCount: 1000,
      shrinkagePct: 3.5,
      totalGrossKg: 5000,
      totalNetKg: 4800,
      totalShrinkKg: 100,
      totalShortageKg: 100,
      totalRealNetKg: 4800,
      details: [
        {
          description: "pollo line 1",
          lineAmount: MonetaryAmount.of(2400),
          order: 0,
          productTypeId: testProductTypeId,
          detailNote: "lote A",
          boxes: 50,
          grossWeight: 2500,
          tare: 50,
          netWeight: 2400,
          unitPrice: 1,
          shrinkage: 50,
          shortage: 50,
          realNetWeight: 2400,
        },
      ],
    });
    const posted = draft.assignSequenceNumber(7).post();
    const aggregateId = posted.id;

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaPurchaseRepository(tx);
      await repo.saveTx(posted);
    });

    const persisted = await prisma.purchase.findFirst({
      where: { id: aggregateId, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.purchaseType).toBe("POLLO_FAENADO");
    expect(persisted!.status).toBe("POSTED");
    expect(persisted!.sequenceNumber).toBe(7);
    expect(Number(persisted!.totalAmount)).toBe(2400);
    expect(persisted!.farmOrigin).toBe("Granja A");
    expect(persisted!.chickenCount).toBe(1000);
    expect(Number(persisted!.shrinkagePct)).toBe(3.5);
    expect(Number(persisted!.totalGrossKg)).toBe(5000);
    expect(Number(persisted!.totalNetKg)).toBe(4800);
    expect(Number(persisted!.totalShrinkKg)).toBe(100);
    expect(Number(persisted!.totalShortageKg)).toBe(100);
    expect(Number(persisted!.totalRealNetKg)).toBe(4800);
    const d = persisted!.details[0];
    expect(d.productTypeId).toBe(testProductTypeId);
    expect(d.detailNote).toBe("lote A");
    expect(d.boxes).toBe(50);
    expect(Number(d.grossWeight)).toBe(2500);
    expect(Number(d.tare)).toBe(50);
    expect(Number(d.netWeight)).toBe(2400);
    expect(Number(d.unitPrice)).toBe(1);
    expect(Number(d.shrinkage)).toBe(50);
    expect(Number(d.shortage)).toBe(50);
    expect(Number(d.realNetWeight)).toBe(2400);
  });

  it("saveTx: normalizes header date to noon UTC (legacy toNoonUtc parity, detail.fecha NOT normalized)", async () => {
    // RED honesty: pre-GREEN stub throw. Post-GREEN: header `purchase.date`
    // pasa por `toNoonUtc` mirror legacy `:190,253` y row queda 12:00 UTC.
    // Asimetría confirmada en pre-recon: legacy detail.fecha (`:432`) persiste
    // raw — NO toNoonUtc. Este test verifica solo header (detail.fecha sin
    // setear).
    const draft = Purchase.createDraft({
      organizationId: testOrgId,
      purchaseType: "FLETE",
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T14:30:00Z"),
      description: "non-noon date purchase",
      createdById: testUserId,
      details: [
        {
          description: "line 1",
          lineAmount: MonetaryAmount.of(100),
          order: 0,
        },
      ],
    });
    const aggregateId = draft.id;

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaPurchaseRepository(tx);
      await repo.saveTx(draft);
    });

    const persisted = await prisma.purchase.findFirst({
      where: { id: aggregateId, organizationId: testOrgId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.date.toISOString()).toBe("2099-01-15T12:00:00.000Z");
  });
});
