import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { Money } from "@/modules/shared/domain/value-objects/money";

import { PrismaJournalEntriesRepository } from "../prisma-journal-entries.repo";

/**
 * Postgres-real integration test for PrismaJournalEntriesRepository (POC #10
 * C3-B). Same pattern as `prisma-account-balances.repo.integration.test.ts`
 * (C3-A): DATABASE_URL = dev DB, strict cleanup by orgId fixtures, never by
 * timestamp.
 *
 * Fixtures (`beforeAll`): User + Org + FiscalPeriod (year 2099, OPEN) +
 * VoucherType + 2 Accounts (1 ASSET DEUDORA, 1 PASIVO ACREEDORA). Same
 * baseline as C3-A plus VoucherType (FK from `journal_entries.voucherTypeId`).
 *
 * Cleanup `afterAll` follows `convention/integration-test-cleanup-pattern`
 * with C3-B extensions:
 *   - paso 0 (NEW): journal_lines explícito ANTES de journal_entries —
 *     defensa contra el trigger AFTER DELETE de `journal_lines` que consulta
 *     el padre `journal_entries` para resolver `organizationId`. Si confiamos
 *     en CASCADE, el padre ya no existe cuando dispara el trigger child y
 *     cae al fallback `app.current_organization_id` (no seteado por Prisma).
 *   - paso 3 (heredado C3-A): `auditLog.deleteMany` por organizationId antes
 *     de `organization.delete`. Captura los logs generados por triggers
 *     `audit_journal_entries`, `audit_journal_lines`, `audit_fiscal_periods`.
 */

describe("PrismaJournalEntriesRepository — Postgres integration", () => {
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
        clerkUserId: `pjer-test-clerk-user-${stamp}`,
        email: `pjer-test-${stamp}@test.local`,
        name: "PrismaJournalEntriesRepository Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pjer-test-clerk-org-${stamp}`,
        name: `PrismaJournalEntriesRepository Integration Test Org ${stamp}`,
        slug: `pjer-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pjer-integration-period",
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

  afterEach(async () => {
    // Aislamiento entre tests del mismo describe (RED 1/RED 2/RED 3 reusan
    // orgId+periodId+voucherType). Child antes de padre — convention extension
    // P2 — el trigger AFTER DELETE de journal_lines consulta journal_entries.
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountBalance.deleteMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
    });
  });

  afterAll(async () => {
    // FK-safe order, child→parent en cascada, paso 3 obligatorio:
    //   1. journal_lines (child antes de padre por trigger lookup parental)
    //   2. journal_entries
    //   3. account_balances
    //   4. accounts
    //   5. voucher_types (NUEVO C3-B vs C3-A)
    //   6. fiscal_period
    //   7. audit_logs (paso 3 — captura todos los triggers)
    //   8. organization
    //   9. user
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

  function buildDraftJournal(): Journal {
    return Journal.create({
      organizationId: testOrgId,
      date: new Date("2099-01-15T00:00:00Z"),
      description: "C3-B integration test entry",
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
  }

  it("create: persists header + lines and returns aggregate hydrated from DB with DB-assigned ids", async () => {
    // Contrato del port `create` (POC #10 C3-B §13 emergente):
    //   - El aggregate de retorno está hidratado desde DB, NO es el input.
    //   - El `id` (y los `lines[].id`) son CUIDs asignados por Prisma vía
    //     `@default(cuid())`, distintos de los UUIDs pre-persist generados
    //     por `Journal.create()` / `JournalLine.create()`.
    //   - El `number` lo asigna el retry loop legacy
    //     (`createWithRetryTx`), no el aggregate.
    // Coherente con `update` y `updateStatus` cuyo JSDoc ya documenta
    // "hydrated from DB". Decisión §13 lockeada: la identidad pre-persist
    // del aggregate se descarta — el use case usa el return value.
    const draft = buildDraftJournal();

    const persisted = await prisma.$transaction(async (tx) => {
      const repo = new PrismaJournalEntriesRepository(tx);
      return repo.create(draft);
    });

    // 1. Aggregate de retorno con ids hidratados de DB (NO los del draft).
    expect(persisted.id).toBeDefined();
    expect(persisted.id).not.toBe(draft.id);
    expect(persisted.number).toBe(1);
    expect(persisted.status).toBe("DRAFT");
    expect(persisted.organizationId).toBe(testOrgId);
    expect(persisted.lines).toHaveLength(2);
    expect(persisted.lines[0].id).toBeDefined();
    expect(persisted.lines[0].id).not.toBe(draft.lines[0].id);
    expect(persisted.lines[1].id).toBeDefined();
    expect(persisted.lines[1].id).not.toBe(draft.lines[1].id);

    // 2. Fila journal_entries persistida bajo el id hidratado, shape correcto.
    const row = await prisma.journalEntry.findUnique({
      where: { id: persisted.id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row).not.toBeNull();
    expect(row!.organizationId).toBe(testOrgId);
    expect(row!.number).toBe(1);
    expect(row!.status).toBe("DRAFT");
    expect(row!.description).toBe("C3-B integration test entry");
    expect(row!.periodId).toBe(testPeriodId);
    expect(row!.voucherTypeId).toBe(testVoucherTypeId);
    expect(row!.contactId).toBeNull();
    expect(row!.sourceType).toBeNull();
    expect(row!.sourceId).toBeNull();
    expect(row!.referenceNumber).toBeNull();
    expect(row!.aiOriginalText).toBeNull();
    expect(row!.createdById).toBe(testUserId);

    // 3. Lines persistidas con debit/credit + ordering.
    expect(row!.lines).toHaveLength(2);
    expect(row!.lines[0].accountId).toBe(assetAccountId);
    expect(row!.lines[0].debit.toString()).toBe("100");
    expect(row!.lines[0].credit.toString()).toBe("0");
    expect(row!.lines[0].order).toBe(0);
    expect(row!.lines[1].accountId).toBe(liabilityAccountId);
    expect(row!.lines[1].debit.toString()).toBe("0");
    expect(row!.lines[1].credit.toString()).toBe("100");
    expect(row!.lines[1].order).toBe(1);
  });

  it("updateStatus: persists status transition + updatedById, returns aggregate hydrated from DB with lines preserved", async () => {
    // Setup: persistir un DRAFT primero (apoyándose en ciclo 1 GREEN). El
    // aggregate retornado tiene id de DB (CUID), que se conserva al pasar
    // por `current.post()` (Journal.transitionTo preserva props en clone).
    const draft = buildDraftJournal();
    const persistedDraft = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).create(draft);
    });
    const transitioned = persistedDraft.post();
    expect(transitioned.id).toBe(persistedDraft.id);
    expect(transitioned.status).toBe("POSTED");

    // Acto: persistir la transición DRAFT → POSTED.
    const persisted = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).updateStatus(
        transitioned,
        testUserId,
      );
    });

    // 1. Aggregate de retorno hidratado de DB — id preservado (UPDATE no
    //    cambia id), status nuevo, updatedById asignado.
    expect(persisted.id).toBe(persistedDraft.id);
    expect(persisted.status).toBe("POSTED");
    expect(persisted.updatedById).toBe(testUserId);
    expect(persisted.organizationId).toBe(testOrgId);
    expect(persisted.lines).toHaveLength(2);

    // 2. Fila DB con status nuevo + updatedById, lines intactas.
    const row = await prisma.journalEntry.findUnique({
      where: { id: persistedDraft.id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("POSTED");
    expect(row!.updatedById).toBe(testUserId);
    expect(row!.lines).toHaveLength(2);
    expect(row!.lines[0].accountId).toBe(assetAccountId);
    expect(row!.lines[0].debit.toString()).toBe("100");
    expect(row!.lines[0].credit.toString()).toBe("0");
    expect(row!.lines[1].accountId).toBe(liabilityAccountId);
    expect(row!.lines[1].debit.toString()).toBe("0");
    expect(row!.lines[1].credit.toString()).toBe("100");
  });

  it("update with replaceLines: false — persists header only, lines preserved with same ids", async () => {
    // Setup: persistir DRAFT con 2 lines.
    const draft = buildDraftJournal();
    const persistedDraft = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).create(draft);
    });
    const originalLineIds = persistedDraft.lines.map((l) => l.id);

    // Header-only mutation (sin replaceLines).
    const mutated = persistedDraft.update({
      description: "Description updated by C3-B test 3a",
      updatedById: testUserId,
    });

    // Acto: persistir con replaceLines: false.
    const persisted = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).update(mutated, {
        replaceLines: false,
      });
    });

    // 1. Aggregate de retorno con header actualizado, lines con ids preservados.
    expect(persisted.id).toBe(persistedDraft.id);
    expect(persisted.description).toBe("Description updated by C3-B test 3a");
    expect(persisted.updatedById).toBe(testUserId);
    expect(persisted.lines).toHaveLength(2);
    expect(persisted.lines.map((l) => l.id)).toEqual(originalLineIds);

    // 2. Fila DB con header actualizado, lines preservadas (ids + content).
    const row = await prisma.journalEntry.findUnique({
      where: { id: persistedDraft.id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row!.description).toBe("Description updated by C3-B test 3a");
    expect(row!.updatedById).toBe(testUserId);
    expect(row!.lines).toHaveLength(2);
    expect(row!.lines.map((l) => l.id)).toEqual(originalLineIds);
    expect(row!.lines[0].accountId).toBe(assetAccountId);
    expect(row!.lines[0].debit.toString()).toBe("100");
    expect(row!.lines[1].accountId).toBe(liabilityAccountId);
    expect(row!.lines[1].credit.toString()).toBe("100");
  });

  it("update with replaceLines: true — persists header + replaces lines (new ids, new contents, old ids gone)", async () => {
    // Setup: persistir DRAFT con 2 lines originales (debit/credit 100).
    const draft = buildDraftJournal();
    const persistedDraft = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).create(draft);
    });
    const originalLineIds = persistedDraft.lines.map((l) => l.id);

    // Header + lines mutation: new amounts (50/50) on the same accounts.
    const mutated = persistedDraft
      .update({
        description: "Description updated by C3-B test 3b",
        updatedById: testUserId,
      })
      .replaceLines([
        {
          accountId: assetAccountId,
          side: LineSide.debit(Money.of("50")),
        },
        {
          accountId: liabilityAccountId,
          side: LineSide.credit(Money.of("50")),
        },
      ]);

    // Acto: persistir con replaceLines: true.
    const persisted = await prisma.$transaction(async (tx) => {
      return new PrismaJournalEntriesRepository(tx).update(mutated, {
        replaceLines: true,
      });
    });

    // 1. Aggregate de retorno con header actualizado, lines con ids NUEVOS
    //    (legacy `updateTx` hace deleteMany+createMany → CUIDs frescos).
    expect(persisted.id).toBe(persistedDraft.id);
    expect(persisted.description).toBe("Description updated by C3-B test 3b");
    expect(persisted.updatedById).toBe(testUserId);
    expect(persisted.lines).toHaveLength(2);
    for (const line of persisted.lines) {
      expect(originalLineIds).not.toContain(line.id);
    }

    // 2. Fila DB con header actualizado, lines con ids nuevos + contenido nuevo.
    const row = await prisma.journalEntry.findUnique({
      where: { id: persistedDraft.id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row!.description).toBe("Description updated by C3-B test 3b");
    expect(row!.updatedById).toBe(testUserId);
    expect(row!.lines).toHaveLength(2);
    for (const line of row!.lines) {
      expect(originalLineIds).not.toContain(line.id);
    }
    expect(row!.lines[0].accountId).toBe(assetAccountId);
    expect(row!.lines[0].debit.toString()).toBe("50");
    expect(row!.lines[0].credit.toString()).toBe("0");
    expect(row!.lines[1].accountId).toBe(liabilityAccountId);
    expect(row!.lines[1].debit.toString()).toBe("0");
    expect(row!.lines[1].credit.toString()).toBe("50");

    // 3. Las lines originales NO existen en DB.
    const orphanLines = await prisma.journalLine.findMany({
      where: { id: { in: originalLineIds } },
    });
    expect(orphanLines).toHaveLength(0);
  });
});
