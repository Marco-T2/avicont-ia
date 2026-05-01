import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import { prisma } from "@/lib/prisma";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { LegacyJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/legacy-journal-entries-read.adapter";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { Sale } from "@/modules/sale/domain/sale.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Money } from "@/modules/shared/domain/value-objects/money";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { PrismaSaleUnitOfWork } from "../prisma-sale-unit-of-work";

/**
 * Postgres-real integration test for PrismaSaleUnitOfWork (POC #11.0a A3
 * Ciclo 6). Mirror POC #10 `prisma-accounting-unit-of-work.integration.test.ts`
 * — same 4 invariantes inherited via `withAuditTx` + scope-bound repos
 * cross-module wiring guard.
 *
 * Capa POR ENCIMA del shared `prisma-unit-of-work.integration.test.ts` que ya
 * valida Postgres-real las 4 invariantes (correlationId pre-tx, SET LOCAL
 * inside, fn invoke, return shape). Aquí ejercemos el `SaleScope` sale-hex
 * específico: 2 surfaces críticas cross-module deben compartir la misma tx
 * outer abierta por `withAuditTx`.
 *
 * 2 surfaces lockeadas Marco (D-Sale-UoW#3 Ciclo 6, opción a):
 *   - `scope.sales.saveTx` (sale-hex own — Prisma directo Ciclo 3)
 *   - `scope.journalEntries.create` (cross-module — POC #10 C3-B)
 * Las otras 4 (accountBalances, receivables, journalEntryFactory,
 * ivaBookRegenNotifier, ivaBookVoidCascade) tienen su propia integration
 * test Ciclo 5 / POC #10 — redundancia con setup pesado descartada.
 *
 * Fixtures `beforeAll`: User + Org + FiscalPeriod + VoucherType + Contact +
 * 3 Accounts (asset DEUDORA, liability ACREEDORA, income ACREEDORA). Stamp
 * `psuow-` para distinguir de psr- (Ciclo 3), paouw- (POC #10 C5 P8).
 *
 * Failure mode declarado (§8.6 + RED honesty preventivo): RED genuino al
 * import-time porque `PrismaSaleUnitOfWork` no existe aún. Step (3) GREEN
 * crea el adapter + composition root. Setup discriminante:
 *   - scope.sales con tx wrong (ej. prisma global) → sale sobrevive rollback test.
 *   - scope.journalEntries con tx wrong → idem journal.
 *
 * Cleanup `afterEach` aisla los 2 tests del describe + limpia audit por
 * correlationId capturado. `afterAll` paso 3 audit_logs orgId obligatorio
 * (captura audit_sales + audit_sale_details + audit_journal_entries +
 * audit_journal_lines triggers).
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

// Cross-module deps reales (no stubs): instancias singletons-like con default
// ctor — paridad legacy. Sólo `sales` + `journalEntries` se ejercen en estos
// 2 tests, pero el constructor del adapter exige las 4 deps por D-2 Ciclo 4.
const journalEntriesReadPort = new LegacyJournalEntriesReadAdapter();
const accountLookupPort = new LegacyAccountLookupAdapter();
const autoEntryGen = new AutoEntryGenerator(
  new AccountsRepository(),
  new VoucherTypesRepository(),
);
const ivaBooksService = new IvaBooksService();

describe("PrismaSaleUnitOfWork — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let testContactId: string;
  let assetAccountId: string;
  let liabilityAccountId: string;
  let incomeAccountId: string;
  const capturedCorrelationIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `psuow-test-clerk-user-${stamp}`,
        email: `psuow-test-${stamp}@test.local`,
        name: "PrismaSaleUnitOfWork Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `psuow-test-clerk-org-${stamp}`,
        name: `PrismaSaleUnitOfWork Integration Test Org ${stamp}`,
        slug: `psuow-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "psuow-integration-period",
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

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Customer",
        type: "CLIENTE",
        nit: "1234567",
      },
    });
    testContactId = contact.id;

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

    const income = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "4100",
        name: "Test Income",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
      },
    });
    incomeAccountId = income.id;
  });

  afterEach(async () => {
    // Aislamiento child→parent: sale_details/journal_lines antes de padres
    // por trigger AFTER DELETE lookup parental (extensión P2 convention C3-B).
    await prisma.saleDetail.deleteMany({
      where: { sale: { organizationId: testOrgId } },
    });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
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
    // FK-safe child→parent + paso 3 audit_logs orgId obligatorio.
    await prisma.saleDetail.deleteMany({
      where: { sale: { organizationId: testOrgId } },
    });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
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

  function buildDraftSale(): Sale {
    return Sale.createDraft({
      organizationId: testOrgId,
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T12:00:00Z"),
      description: "psuow integration sale",
      createdById: testUserId,
      details: [
        {
          description: "line 1",
          lineAmount: MonetaryAmount.of(100),
          order: 0,
          incomeAccountId,
        },
      ],
    });
  }

  function buildDraftJournal(): Journal {
    return Journal.create({
      organizationId: testOrgId,
      date: new Date("2099-01-15T00:00:00Z"),
      description: "psuow integration journal",
      periodId: testPeriodId,
      voucherTypeId: testVoucherTypeId,
      createdById: testUserId,
      lines: [
        { accountId: assetAccountId, side: LineSide.debit(Money.of("100")) },
        {
          accountId: liabilityAccountId,
          side: LineSide.credit(Money.of("100")),
        },
      ],
    });
  }

  it("commit: scope.sales.saveTx + scope.journalEntries.create share tx + audit row matches correlationId", async () => {
    const uow = new PrismaSaleUnitOfWork(
      repo,
      journalEntriesReadPort,
      accountLookupPort,
      autoEntryGen,
      () => ivaBooksService,
    );
    const draftSale = buildDraftSale();
    const draftJournal = buildDraftJournal();

    const { result, correlationId } = await uow.run(
      { userId: testUserId, organizationId: testOrgId },
      async (scope) => {
        const persistedSale = await scope.sales.saveTx(draftSale);
        const persistedJournal = await scope.journalEntries.create(
          draftJournal,
        );
        return { saleId: persistedSale.id, journalId: persistedJournal.id };
      },
    );
    capturedCorrelationIds.push(correlationId);

    // 1. Sale persistida bajo orgId — cableo scope.sales→tx outer.
    const saleRow = await prisma.sale.findUnique({
      where: { id: result.saleId },
    });
    expect(saleRow).not.toBeNull();
    expect(saleRow!.organizationId).toBe(testOrgId);

    // 2. Journal persistido bajo orgId — cableo scope.journalEntries→tx outer.
    const journalRow = await prisma.journalEntry.findUnique({
      where: { id: result.journalId },
    });
    expect(journalRow).not.toBeNull();
    expect(journalRow!.organizationId).toBe(testOrgId);

    // 3. Audit row con correlationId pre-tx + changedById SET LOCAL —
    //    invariantes withAuditTx vivas a través del SaleScope.
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId, organizationId: testOrgId },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.every((r) => r.changedById === testUserId)).toBe(true);
  });

  it("rollback: fn throws after scope.sales.saveTx + scope.journalEntries.create → ningún sale, journal ni audit persiste", async () => {
    const uow = new PrismaSaleUnitOfWork(
      repo,
      journalEntriesReadPort,
      accountLookupPort,
      autoEntryGen,
      () => ivaBooksService,
    );
    const draftSale = buildDraftSale();
    const draftJournal = buildDraftJournal();
    let scopeIdBeforeThrow: string | undefined;
    const boom = new Error("rollback-me");

    await expect(
      uow.run(
        { userId: testUserId, organizationId: testOrgId },
        async (scope) => {
          scopeIdBeforeThrow = scope.correlationId;
          await scope.sales.saveTx(draftSale);
          await scope.journalEntries.create(draftJournal);
          throw boom;
        },
      ),
    ).rejects.toBe(boom);

    expect(scopeIdBeforeThrow).toBeDefined();
    capturedCorrelationIds.push(scopeIdBeforeThrow!);

    // Si scope.sales usara tx distinta al outer, sale sobreviviría.
    const sales = await prisma.sale.findMany({
      where: { organizationId: testOrgId },
    });
    expect(sales.length).toBe(0);

    // Si scope.journalEntries usara tx distinta al outer, journal sobreviviría.
    const journals = await prisma.journalEntry.findMany({
      where: { organizationId: testOrgId },
    });
    expect(journals.length).toBe(0);

    // No audit row para correlationId rollbackeado.
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId: scopeIdBeforeThrow! },
    });
    expect(auditRows.length).toBe(0);
  });
});
