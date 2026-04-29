import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { Money } from "@/modules/shared/domain/value-objects/money";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { PrismaAccountingUnitOfWork } from "../prisma-accounting-unit-of-work";

/**
 * Postgres-real integration test for PrismaAccountingUnitOfWork (POC #10 C5
 * Ciclo 2 P8). Regression guard contra rebuilds del composition root con scope
 * incompleto: ejerce AMBOS repos accounting-specific (`journalEntries` y
 * `accountBalances`) bajo el mismo `uow.run` para garantizar que ambos
 * participan de la tx outer abierta por `withAuditTx`.
 *
 * Capa POR ENCIMA del unit + contract test (`prisma-accounting-unit-of-work.test.ts`)
 * que ya valida con mocks la delegación shape + las 4 invariantes inherited de
 * `withAuditTx`. Las invariantes Postgres-real (correlationId pre-tx, SET LOCAL
 * inside, fn invoke, return shape) están cubiertas por el integration test
 * shared `prisma-unit-of-work.integration.test.ts` — no se duplican aquí.
 *
 * Failure mode declarado (feedback/red-acceptance-failure-mode): con master en
 * `43a7849` el composition root ya cablea los 3 repos a la tx outer (creado en
 * C3-D Ciclo 1 `3122c27`). Los 2 tests PASAN al primer correr — NOT RED
 * genuino, caracterización con setup discriminante:
 *   - scope.journalEntries undefined → test 1 ReferenceError (ambos fallan).
 *   - scope.accountBalances undefined → idem.
 *   - journalEntries con tx wrong (ej. `prisma` global) → test 2 falla porque
 *     journal sobrevive el rollback.
 *   - accountBalances con tx wrong → idem.
 *
 * Path corto del flow: `create(draft DRAFT) → persisted.post() in-memory →
 * accountBalances.applyPost(posted)`. Skipea `updateStatus` porque usa el mismo
 * repo `journalEntries` y no agrega nuevo guard de wiring (decisión spike
 * pre-RED §13). `applyPost` no lee `status`, solo `lines + organizationId +
 * periodId`, por lo que el `.post()` in-memory satisface la semántica POSTED
 * sin requerir update DB.
 *
 * Fixtures `beforeAll` (heredado C3-B): User + Org + FiscalPeriod (year 2099,
 * OPEN) + VoucherType + 2 Accounts (asset DEUDORA, liability ACREEDORA). Stamp
 * `paouw-` para distinguir de los fixtures C3-A (`abr-`) y C3-B (`pjer-`).
 *
 * Cleanup `afterAll` sigue convention/integration-test-cleanup-pattern con
 * extensión P2 C3-B (child journal_lines antes de padre journal_entries por
 * trigger AFTER DELETE lookup parental) + paso 3 obligatorio audit_logs por
 * orgId. `afterEach` aisla los 2 tests del describe + limpia audit por
 * correlationId capturado (paso heredado del shared integration test).
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

describe("PrismaAccountingUnitOfWork — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let assetAccountId: string;
  let liabilityAccountId: string;
  const capturedCorrelationIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `paouw-test-clerk-user-${stamp}`,
        email: `paouw-test-${stamp}@test.local`,
        name: "PrismaAccountingUnitOfWork Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `paouw-test-clerk-org-${stamp}`,
        name: `PrismaAccountingUnitOfWork Integration Test Org ${stamp}`,
        slug: `paouw-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "paouw-integration-period",
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
    // Aislamiento entre tests: child-first por trigger AFTER DELETE de
    // journal_lines (extensión P2 convention C3-B). Audit por correlationId
    // captura los rows generados por uow.run (commit test); rollback test no
    // genera audit rows pero igual capturamos por simetría.
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountBalance.deleteMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
    });
    if (capturedCorrelationIds.length > 0) {
      const ids = [...capturedCorrelationIds];
      capturedCorrelationIds.length = 0;
      await prisma.auditLog.deleteMany({
        where: { correlationId: { in: ids } },
      });
    }
  });

  afterAll(async () => {
    // FK-safe child→parent + paso 3 obligatorio audit_logs por orgId.
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
      description: "C5 P8 integration test entry",
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

  it("commit: scope.journalEntries.create + scope.accountBalances.applyPost share tx + audit row matches correlationId", async () => {
    const uow = new PrismaAccountingUnitOfWork(repo);
    const draft = buildDraftJournal();

    const { result, correlationId } = await uow.run(
      { userId: testUserId, organizationId: testOrgId },
      async (scope) => {
        const persisted = await scope.journalEntries.create(draft);
        const posted = persisted.post();
        await scope.accountBalances.applyPost(posted);
        return persisted;
      },
    );
    capturedCorrelationIds.push(correlationId);

    // 1. Journal persistido bajo orgId — cableo journalEntries→tx outer.
    const journalRow = await prisma.journalEntry.findUnique({
      where: { id: result.id },
    });
    expect(journalRow).not.toBeNull();
    expect(journalRow!.organizationId).toBe(testOrgId);

    // 2. Balances persistidos para ambas cuentas — cableo accountBalances→tx outer.
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
      orderBy: { account: { code: "asc" } },
    });
    expect(balances.length).toBe(2);
    expect(balances[0].accountId).toBe(assetAccountId);
    expect(balances[0].balance.toString()).toBe("100");
    expect(balances[1].accountId).toBe(liabilityAccountId);
    expect(balances[1].balance.toString()).toBe("100");

    // 3. Audit row con correlationId pre-tx + changedById SET LOCAL — invariantes
    //    withAuditTx vivas a través del scope accounting-specific.
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId, organizationId: testOrgId },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.every((r) => r.changedById === testUserId)).toBe(true);
  });

  it("rollback: fn throws after journalEntries.create + accountBalances.applyPost → ningún journal, balance ni audit persiste", async () => {
    const uow = new PrismaAccountingUnitOfWork(repo);
    const draft = buildDraftJournal();
    let scopeIdBeforeThrow: string | undefined;
    const boom = new Error("rollback-me");

    await expect(
      uow.run(
        { userId: testUserId, organizationId: testOrgId },
        async (scope) => {
          scopeIdBeforeThrow = scope.correlationId;
          const persisted = await scope.journalEntries.create(draft);
          await scope.accountBalances.applyPost(persisted.post());
          throw boom;
        },
      ),
    ).rejects.toBe(boom);

    expect(scopeIdBeforeThrow).toBeDefined();
    capturedCorrelationIds.push(scopeIdBeforeThrow!);

    // Si journalEntries usara tx distinta al outer, journal sobreviviría.
    const journals = await prisma.journalEntry.findMany({
      where: { organizationId: testOrgId },
    });
    expect(journals.length).toBe(0);

    // Si accountBalances usara tx distinta al outer, balance sobreviviría.
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
    });
    expect(balances.length).toBe(0);

    // No audit row para correlationId rollbackeado.
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId: scopeIdBeforeThrow! },
    });
    expect(auditRows.length).toBe(0);
  });
});
