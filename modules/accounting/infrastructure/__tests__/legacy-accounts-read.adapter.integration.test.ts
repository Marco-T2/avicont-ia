import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

import { LegacyAccountsReadAdapter } from "../legacy-accounts-read.adapter";

/**
 * Postgres-real integration test for LegacyAccountsReadAdapter (POC #10
 * C3-C Ciclo 2). Mirrors the fixture/cleanup shape of
 * `prisma-journal-entries-read.adapter.integration.test.ts` (Ciclo 1):
 * DATABASE_URL = dev DB, strict cleanup by orgId fixtures, never by timestamp.
 *
 * Cleanup `afterAll` follows `convention/integration-test-cleanup-pattern`
 * (lockeada C3-A, extendida C3-B): Account is a leaf for this fixture set
 * (no journalLine fixtures here) so cleanup order is account → auditLog
 * (paso 3 obligatorio antes de organization) → organization → user.
 */

describe("LegacyAccountsReadAdapter — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testAccountId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `larad-test-clerk-user-${stamp}`,
        email: `larad-test-${stamp}@test.local`,
        name: "LegacyAccountsReadAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `larad-test-clerk-org-${stamp}`,
        name: `LegacyAccountsReadAdapter Integration Test Org ${stamp}`,
        slug: `larad-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const account = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "1100",
        name: "Caja",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 1,
        isDetail: true,
        requiresContact: false,
        isActive: true,
      },
    });
    testAccountId = account.id;
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("findById: returns AccountReadDto narrowed to 5 fields when account exists", async () => {
    const adapter = new LegacyAccountsReadAdapter();
    const found = await adapter.findById(testOrgId, testAccountId);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(testAccountId);
    expect(found!.name).toBe("Caja");
    expect(found!.isActive).toBe(true);
    expect(found!.isDetail).toBe(true);
    expect(found!.requiresContact).toBe(false);
    // Narrow guard: AccountReadDto has 5 fields exactly. The Account row has
    // 15+ fields (code, type, nature, level, parentId, description,
    // isContraAccount, organizationId, createdAt, updatedAt, ...). Wrap-thin
    // adapter MUST drop everything outside the dto. Returning the full row
    // would still satisfy the field-by-field assertions above — this key set
    // assertion is the explicit guard against that drift. Refuerza
    // observación "narrowing como segunda función del wrapper".
    expect(Object.keys(found!).sort()).toEqual([
      "id",
      "isActive",
      "isDetail",
      "name",
      "requiresContact",
    ]);
  });

  it("findById: returns null when account does not exist for the organization", async () => {
    // Contrato del port (JSDoc `accounts-read.port.ts`): "The adapter MUST
    // return null when the account does not exist; the use case surfaces
    // NotFoundError." Test guard contra futuros refactors que transformen
    // el null en throw o undefined. Mismo patrón Ciclo 1 test 1b
    // (`feedback/red-acceptance-failure-mode`): el failure mode esperado
    // ("adapter throws on missing id") NO es manifestable — el GREEN 2a
    // tiene `if (!row) return null` como única ruta typesafe (TypeScript
    // exige el null check, no es preemptiva). El test corre y pasa como
    // guard del contrato JSDoc, NO está con `.skip()`.
    const adapter = new LegacyAccountsReadAdapter();
    const found = await adapter.findById(
      testOrgId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(found).toBeNull();
  });
});
