import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaPurchaseReaderAdapter } from "../prisma-purchase-reader.adapter";

/**
 * Postgres-real integration test for PrismaPurchaseReaderAdapter (POC #11.0c
 * A3 C1 RED Round 1). Mirror simétrico de
 * `prisma-sale-reader.adapter.integration.test.ts` con Purchase model en
 * lugar de Sale.
 *
 * Adapter contract (`purchase-reader.port.ts`): narrow snapshot
 * `{ id, organizationId, status }` — `getById(orgId, purchaseId)` retorna
 * `PurchaseSnapshot | null`. Status union widened POC #11.0c A3 pre-C1 a 4
 * valores schema parity: `DRAFT | POSTED | LOCKED | VOIDED`.
 *
 * RED honesty preventivo (`feedback/red-acceptance-failure-mode`): TODOS los
 * `it()` FAIL pre-implementación por module resolution failure
 * (`PrismaPurchaseReaderAdapter` no existe en `infrastructure/`). Post-GREEN:
 * PASSES cuando el adapter delega a
 * `prisma.purchase.findUnique({ where: { id, organizationId } })` y narrow
 * al shape `PurchaseSnapshot`.
 */

describe("PrismaPurchaseReaderAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testOtherOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `ppr-test-clerk-user-${stamp}`,
        email: `ppr-test-${stamp}@test.local`,
        name: "PrismaPurchaseReaderAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `ppr-test-clerk-org-${stamp}`,
        name: `PrismaPurchaseReaderAdapter Integration Test Org ${stamp}`,
        slug: `ppr-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const otherOrg = await prisma.organization.create({
      data: {
        clerkOrgId: `ppr-test-clerk-other-org-${stamp}`,
        name: `PrismaPurchaseReaderAdapter Other Org ${stamp}`,
        slug: `ppr-test-other-org-${stamp}`,
      },
    });
    testOtherOrgId = otherOrg.id;

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
        name: "Test Provider",
        type: "PROVEEDOR",
        nit: "7654321",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.purchase.deleteMany({
      where: { organizationId: testOtherOrgId },
    });
  });

  afterAll(async () => {
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.purchase.deleteMany({
      where: { organizationId: testOtherOrgId },
    });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOtherOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.organization.delete({ where: { id: testOtherOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function seedPurchase(opts: {
    organizationId?: string;
    sequenceNumber: number;
    status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.purchase.create({
      data: {
        id,
        organizationId: opts.organizationId ?? testOrgId,
        purchaseType: "COMPRA_GENERAL",
        status: opts.status,
        sequenceNumber: opts.sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "ppr seeded purchase",
        totalAmount: new Prisma.Decimal("100.00"),
        createdById: testUserId,
      },
    });
    return id;
  }

  it("getById: existing purchase — returns narrow snapshot {id, organizationId, status}", async () => {
    // RED honesty preventivo: FAILS pre-implementación por module resolution
    // failure (`PrismaPurchaseReaderAdapter` no existe). Post-GREEN: PASSES
    // porque adapter delega a `findUnique({where:{id, organizationId}})` y
    // narrow al shape `PurchaseSnapshot` (drop purchaseType, sequenceNumber,
    // date, contactId, periodId, description, totalAmount, etc.).
    const purchaseId = await seedPurchase({
      sequenceNumber: 1,
      status: "POSTED",
    });

    const adapter = new PrismaPurchaseReaderAdapter(prisma);

    const result = await adapter.getById(testOrgId, purchaseId);

    expect(result).toEqual({
      id: purchaseId,
      organizationId: testOrgId,
      status: "POSTED",
    });
  });

  it("getById: non-existent purchase — returns null", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: `findUnique({where:{id, organizationId}})` → null cuando
    // no hay row con ese id (port contract:
    // `Promise<PurchaseSnapshot | null>`).
    const adapter = new PrismaPurchaseReaderAdapter(prisma);

    const result = await adapter.getById(
      testOrgId,
      "00000000-0000-0000-0000-000000000000",
    );

    expect(result).toBeNull();
  });

  it("getById: cross-org tenancy guard — purchase exists in other org returns null", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: where clause `{ id, organizationId }` filtra por
    // organizationId mismatch → null. Mirror A1 purchase-hex tenancy
    // pattern (PrismaPurchaseRepository inline
    // `where: { organizationId, id }`, NO shared helper).
    const purchaseId = await seedPurchase({
      organizationId: testOtherOrgId,
      sequenceNumber: 1,
      status: "POSTED",
    });

    const adapter = new PrismaPurchaseReaderAdapter(prisma);

    const result = await adapter.getById(testOrgId, purchaseId);

    expect(result).toBeNull();
  });

  it.each([
    ["DRAFT"],
    ["POSTED"],
    ["LOCKED"],
    ["VOIDED"],
  ] as const)(
    "getById: status round-trip — preserves PurchaseStatus enum value %s",
    async (status) => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: parametric assertion sobre los 4 valores PurchaseStatus
      // schema enum (schema:521-526). LOCKED added post-widen POC #11.0c
      // A3 pre-C1 (port = schema parity). Detecta coerce/swallow del
      // adapter sobre cualquiera de los 4 valores — gate consumer
      // `=== "POSTED"` (iva-book.service.ts:766/784) preservado bit-exact.
      const purchaseId = await seedPurchase({ sequenceNumber: 1, status });

      const adapter = new PrismaPurchaseReaderAdapter(prisma);

      const result = await adapter.getById(testOrgId, purchaseId);

      expect(result?.status).toBe(status);
    },
  );
});
