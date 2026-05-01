import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaSaleReaderAdapter } from "../prisma-sale-reader.adapter";

/**
 * Postgres-real integration test for PrismaSaleReaderAdapter (POC #11.0c A3
 * C1 RED Round 1). Mirror precedent A1
 * `modules/sale/infrastructure/__tests__/prisma-iva-book-reader.adapter.integration.test.ts`
 * fixture pattern.
 *
 * Adapter contract (`sale-reader.port.ts`): narrow snapshot
 * `{ id, organizationId, status }` — `getById(orgId, saleId)` retorna
 * `SaleSnapshot | null`. Status union widened POC #11.0c A3 pre-C1 a 4
 * valores schema parity: `DRAFT | POSTED | LOCKED | VOIDED`.
 *
 * RED honesty preventivo (`feedback/red-acceptance-failure-mode`): TODOS los
 * `it()` FAIL pre-implementación por module resolution failure
 * (`PrismaSaleReaderAdapter` no existe en `infrastructure/`). Post-GREEN:
 * PASSES cuando el adapter delega a
 * `prisma.sale.findUnique({ where: { id, organizationId } })` y narrow al
 * shape `SaleSnapshot`.
 */

describe("PrismaSaleReaderAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testOtherOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `psr-test-clerk-user-${stamp}`,
        email: `psr-test-${stamp}@test.local`,
        name: "PrismaSaleReaderAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `psr-test-clerk-org-${stamp}`,
        name: `PrismaSaleReaderAdapter Integration Test Org ${stamp}`,
        slug: `psr-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const otherOrg = await prisma.organization.create({
      data: {
        clerkOrgId: `psr-test-clerk-other-org-${stamp}`,
        name: `PrismaSaleReaderAdapter Other Org ${stamp}`,
        slug: `psr-test-other-org-${stamp}`,
      },
    });
    testOtherOrgId = otherOrg.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "psr-integration-period",
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
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.sale.deleteMany({
      where: { organizationId: testOtherOrgId },
    });
  });

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.sale.deleteMany({
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

  async function seedSale(opts: {
    organizationId?: string;
    sequenceNumber: number;
    status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.sale.create({
      data: {
        id,
        organizationId: opts.organizationId ?? testOrgId,
        status: opts.status,
        sequenceNumber: opts.sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "psr seeded sale",
        totalAmount: new Prisma.Decimal("100.00"),
        createdById: testUserId,
      },
    });
    return id;
  }

  it("getById: existing sale — returns narrow snapshot {id, organizationId, status}", async () => {
    // RED honesty preventivo: FAILS pre-implementación por module resolution
    // failure (`PrismaSaleReaderAdapter` no existe). Post-GREEN: PASSES
    // porque adapter delega a `findUnique({where:{id, organizationId}})` y
    // narrow al shape `SaleSnapshot` (drop sequenceNumber, date, contactId,
    // periodId, description, totalAmount, createdById, etc.).
    const saleId = await seedSale({ sequenceNumber: 1, status: "POSTED" });

    const adapter = new PrismaSaleReaderAdapter(prisma);

    const result = await adapter.getById(testOrgId, saleId);

    expect(result).toEqual({
      id: saleId,
      organizationId: testOrgId,
      status: "POSTED",
    });
  });

  it("getById: non-existent sale — returns null", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: `findUnique({where:{id, organizationId}})` → null cuando
    // no hay row con ese id (port contract: `Promise<SaleSnapshot | null>`).
    const adapter = new PrismaSaleReaderAdapter(prisma);

    const result = await adapter.getById(
      testOrgId,
      "00000000-0000-0000-0000-000000000000",
    );

    expect(result).toBeNull();
  });

  it("getById: cross-org tenancy guard — sale exists in other org returns null", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: where clause `{ id, organizationId }` filtra por
    // organizationId mismatch → null. Mirror A1 sale-hex tenancy pattern
    // (PrismaSaleRepository inline `where: { organizationId, id }`, NO
    // shared helper).
    const saleId = await seedSale({
      organizationId: testOtherOrgId,
      sequenceNumber: 1,
      status: "POSTED",
    });

    const adapter = new PrismaSaleReaderAdapter(prisma);

    const result = await adapter.getById(testOrgId, saleId);

    expect(result).toBeNull();
  });

  it.each([
    ["DRAFT"],
    ["POSTED"],
    ["LOCKED"],
    ["VOIDED"],
  ] as const)(
    "getById: status round-trip — preserves SaleStatus enum value %s",
    async (status) => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: parametric assertion sobre los 4 valores SaleStatus
      // schema enum (schema:507-512). LOCKED added post-widen POC #11.0c
      // A3 pre-C1 (port = schema parity). Detecta coerce/swallow del
      // adapter sobre cualquiera de los 4 valores — gate consumer
      // `=== "POSTED"` (iva-book.service.ts:766/784) preservado bit-exact.
      const saleId = await seedSale({ sequenceNumber: 1, status });

      const adapter = new PrismaSaleReaderAdapter(prisma);

      const result = await adapter.getById(testOrgId, saleId);

      expect(result?.status).toBe(status);
    },
  );
});
