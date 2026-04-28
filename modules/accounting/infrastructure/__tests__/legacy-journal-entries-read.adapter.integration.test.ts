import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { Money } from "@/modules/shared/domain/value-objects/money";

import { PrismaJournalEntriesRepository } from "../prisma-journal-entries.repo";
import { LegacyJournalEntriesReadAdapter } from "../legacy-journal-entries-read.adapter";

/**
 * Postgres-real integration test for LegacyJournalEntriesReadAdapter (POC #10
 * C3-C Ciclo 1). Mirrors the fixture/cleanup shape of
 * `prisma-journal-entries.repo.integration.test.ts` (C3-B): DATABASE_URL = dev
 * DB, strict cleanup by orgId fixtures, never by timestamp.
 *
 * Cleanup `afterAll` follows `convention/integration-test-cleanup-pattern`
 * (lockeada C3-A, extendida C3-B): child antes de padre porque el trigger
 * AFTER DELETE de `journal_lines` consulta el padre `journal_entries` para
 * resolver `organizationId`.
 */

describe("LegacyJournalEntriesReadAdapter — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let assetAccountId: string;
  let liabilityAccountId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `ljerad-test-clerk-user-${stamp}`,
        email: `ljerad-test-${stamp}@test.local`,
        name: "LegacyJournalEntriesReadAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `ljerad-test-clerk-org-${stamp}`,
        name: `LegacyJournalEntriesReadAdapter Integration Test Org ${stamp}`,
        slug: `ljerad-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "ljerad-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const voucherType = await prisma.voucherTypeCfg.create({
      data: {
        organizationId: testOrgId,
        code: "TEST",
        prefix: "T",
        name: "Test Voucher",
        isActive: true,
        isAdjustment: false,
      },
    });
    testVoucherTypeId = voucherType.id;

    const asset = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "1000",
        name: "Test Asset",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 1,
        isDetail: true,
      },
    });
    assetAccountId = asset.id;

    const liability = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "2000",
        name: "Test Liability",
        type: "PASIVO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
      },
    });
    liabilityAccountId = liability.id;
  });

  afterAll(async () => {
    // FK-safe order, child→parent + paso 3 obligatorio (auditLog antes de org).
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountBalance.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.voucherTypeCfg.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("findById: returns Journal aggregate hydrated from DB when entry exists", async () => {
    // Setup: persistir un DRAFT vía el write adapter C3-B dentro de tx —
    // garantiza que el row tiene shape de DB (CUIDs asignados, number = 1,
    // updatedAt sincronizado por Prisma). Patrón paralelo al test de C3-B
    // updateStatus (l245-249).
    const draft = Journal.create({
      organizationId: testOrgId,
      date: new Date("2099-01-15T00:00:00Z"),
      description: "C3-C Ciclo 1 read happy path",
      periodId: testPeriodId,
      voucherTypeId: testVoucherTypeId,
      createdById: testUserId,
      lines: [
        {
          accountId: assetAccountId,
          side: LineSide.debit(Money.of("100")),
        },
        {
          accountId: liabilityAccountId,
          side: LineSide.credit(Money.of("100")),
        },
      ],
    });
    const persistedDraft = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).create(draft);
    });

    // Acto: leer con el read adapter (non-tx — sin $transaction wrapper).
    const adapter = new LegacyJournalEntriesReadAdapter();
    const found = await adapter.findById(testOrgId, persistedDraft.id);

    // 1. Aggregate hidratado, ids preservados respecto del persisted DRAFT.
    expect(found).not.toBeNull();
    expect(found!.id).toBe(persistedDraft.id);
    expect(found!.organizationId).toBe(testOrgId);
    expect(found!.status).toBe("DRAFT");
    expect(found!.number).toBe(1);
    expect(found!.description).toBe("C3-C Ciclo 1 read happy path");
    expect(found!.periodId).toBe(testPeriodId);
    expect(found!.voucherTypeId).toBe(testVoucherTypeId);
    expect(found!.contactId).toBeNull();
    expect(found!.sourceType).toBeNull();
    expect(found!.sourceId).toBeNull();
    expect(found!.referenceNumber).toBeNull();
    expect(found!.createdById).toBe(testUserId);

    // 2. Lines hidratadas con LineSide reconstruido desde debit/credit DB,
    //    preservando ids del persisted DRAFT y orden por `order`. Uso API
    //    canónica del VO (kind + amount) en lugar de las convenience getters
    //    debit/credit que devuelven `Money | null`.
    expect(found!.lines).toHaveLength(2);
    expect(found!.lines[0].id).toBe(persistedDraft.lines[0].id);
    expect(found!.lines[0].accountId).toBe(assetAccountId);
    expect(found!.lines[0].side.kind).toBe("DEBIT");
    expect(found!.lines[0].side.amount.toString()).toBe("100");
    expect(found!.lines[0].order).toBe(0);
    expect(found!.lines[1].id).toBe(persistedDraft.lines[1].id);
    expect(found!.lines[1].accountId).toBe(liabilityAccountId);
    expect(found!.lines[1].side.kind).toBe("CREDIT");
    expect(found!.lines[1].side.amount.toString()).toBe("100");
    expect(found!.lines[1].order).toBe(1);
  });

  it("findById: returns null when entry does not exist for the organization", async () => {
    // Contrato del port (JSDoc): "The adapter MUST return null when the entry
    // does not exist so the use case surfaces NotFoundError("Asiento contable")
    // (parity legacy l558)". Test guard contra futuros refactors que
    // transformen el null en throw o undefined.
    const adapter = new LegacyJournalEntriesReadAdapter();
    const found = await adapter.findById(
      testOrgId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(found).toBeNull();
  });
});
