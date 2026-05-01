import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { LegacyJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/legacy-journal-entries-read.adapter";
import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import { __resetForTesting } from "@/modules/iva-books/presentation/composition-root";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { Purchase } from "@/modules/purchase/domain/purchase.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Money } from "@/modules/shared/domain/value-objects/money";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { PrismaPurchaseUnitOfWork } from "../prisma-purchase-unit-of-work";

/**
 * Postgres-real integration test for PrismaPurchaseUnitOfWork (POC #11.0b A3
 * Ciclo 6b). Mirror sale C6 (`prisma-sale-unit-of-work.integration.test.ts`,
 * commit `31830b0`) byte-equivalent salvo asimetrías declaradas:
 *   - `payables` ↔ `receivables` (purchase scope tx-bound).
 *   - factory cross-module sale-side (`PrismaJournalEntryFactoryAdapter` con
 *     `generateForPurchase`/`regenerateForPurchaseEdit` heredado A3 Ciclo 4 sale).
 *   - contact `type: "PROVEEDOR"` ↔ `"CLIENTE"`.
 *   - 2 accounts (asset + liability) suficientes — `purchaseType: "FLETE"` no
 *     exige `expenseAccountId` en detail (vs sale `incomeAccountId` obligatorio
 *     que justificaba el 3er account en sale C6).
 *
 * Capa POR ENCIMA del shared `prisma-unit-of-work.integration.test.ts` que ya
 * valida Postgres-real las 4 invariantes (correlationId pre-tx, SET LOCAL
 * inside, fn invoke, return shape). Aquí ejercemos el `PurchaseScope`
 * purchase-hex específico: 2 surfaces críticas cross-module deben compartir
 * la misma tx outer abierta por `withAuditTx`.
 *
 * 2 surfaces lockeadas Marco (D-Purch-UoW#3 (a), heredado D-Sale-UoW#3 (a)
 * sale C6):
 *   - `scope.purchases.saveTx` (purchase-hex own — Prisma directo Ciclo 3)
 *   - `scope.journalEntries.create` (cross-module — POC #10 C3-B)
 * Las otras 5 (accountBalances, payables, journalEntryFactory,
 * ivaBookRegenNotifier, ivaBookVoidCascade) tienen su propia integration
 * test C5 / POC #10 / shared — redundancia con setup pesado descartada.
 *
 * Fixtures `beforeAll`: User + Org + FiscalPeriod + VoucherType + Contact
 * (PROVEEDOR) + 2 Accounts (asset DEUDORA, liability ACREEDORA). Stamp
 * `ppuow-` para distinguir de psuow- (sale C6), pposra- (Ciclo 6a).
 *
 * Failure mode declarado (§8.6 + RED honesty preventivo): RED genuino al
 * import-time porque `PrismaPurchaseUnitOfWork` no existe aún. Step (3) GREEN
 * crea el adapter + composition root. Setup discriminante:
 *   - scope.purchases con tx wrong (ej. prisma global) → purchase sobrevive rollback test.
 *   - scope.journalEntries con tx wrong → idem journal.
 *
 * Cleanup `afterEach` aisla los 2 tests del describe + limpia audit por
 * correlationId capturado. `afterAll` paso 3 audit_logs orgId obligatorio
 * (captura audit_purchases + audit_purchase_details + audit_journal_entries +
 * audit_journal_lines triggers — D-Purch-UoW#3 lockeado).
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

// Cross-module deps reales (no stubs): instancias singletons-like con default
// ctor — paridad legacy. Sólo `purchases` + `journalEntries` se ejercen en
// estos 2 tests, pero el constructor del adapter exige las 4 deps por D-2
// Ciclo 4 sale (heredado mirror).
const journalEntriesReadPort = new LegacyJournalEntriesReadAdapter();
const accountLookupPort = new LegacyAccountLookupAdapter();
const autoEntryGen = new AutoEntryGenerator(
  new AccountsRepository(),
  new VoucherTypesRepository(),
);
const ivaBooksService = new IvaBooksService();

describe("PrismaPurchaseUnitOfWork — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let testContactId: string;
  let assetAccountId: string;
  let liabilityAccountId: string;
  const capturedCorrelationIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `ppuow-test-clerk-user-${stamp}`,
        email: `ppuow-test-${stamp}@test.local`,
        name: "PrismaPurchaseUnitOfWork Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `ppuow-test-clerk-org-${stamp}`,
        name: `PrismaPurchaseUnitOfWork Integration Test Org ${stamp}`,
        slug: `ppuow-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "ppuow-integration-period",
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
        name: "Test Provider",
        type: "PROVEEDOR",
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
  });

  afterEach(async () => {
    // Aislamiento child→parent: purchase_details/journal_lines antes de padres
    // por trigger AFTER DELETE lookup parental (extensión P2 convention C3-B).
    await prisma.purchaseDetail.deleteMany({
      where: { purchase: { organizationId: testOrgId } },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
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
    // FK-safe child→parent + paso 3 audit_logs orgId obligatorio
    // (D-Purch-UoW#3 — purchase tiene triggers audit_purchases +
    // audit_purchase_details + audit_journal_entries + audit_journal_lines).
    await prisma.purchaseDetail.deleteMany({
      where: { purchase: { organizationId: testOrgId } },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
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

  function buildDraftPurchase(): Purchase {
    return Purchase.createDraft({
      organizationId: testOrgId,
      purchaseType: "FLETE",
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T12:00:00Z"),
      description: "ppuow integration purchase",
      createdById: testUserId,
      details: [
        {
          description: "line 1",
          lineAmount: MonetaryAmount.of(100),
          order: 0,
        },
      ],
    });
  }

  function buildDraftJournal(): Journal {
    return Journal.create({
      organizationId: testOrgId,
      date: new Date("2099-01-15T00:00:00Z"),
      description: "ppuow integration journal",
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

  it("commit: scope.purchases.saveTx + scope.journalEntries.create share tx + audit row matches correlationId", async () => {
    const uow = new PrismaPurchaseUnitOfWork(
      repo,
      journalEntriesReadPort,
      accountLookupPort,
      autoEntryGen,
      () => ivaBooksService,
    );
    const draftPurchase = buildDraftPurchase();
    const draftJournal = buildDraftJournal();

    const { result, correlationId } = await uow.run(
      { userId: testUserId, organizationId: testOrgId },
      async (scope) => {
        const persistedPurchase = await scope.purchases.saveTx(draftPurchase);
        const persistedJournal = await scope.journalEntries.create(
          draftJournal,
        );
        return {
          purchaseId: persistedPurchase.id,
          journalId: persistedJournal.id,
        };
      },
    );
    capturedCorrelationIds.push(correlationId);

    // 1. Purchase persistida bajo orgId — cableo scope.purchases→tx outer.
    const purchaseRow = await prisma.purchase.findUnique({
      where: { id: result.purchaseId },
    });
    expect(purchaseRow).not.toBeNull();
    expect(purchaseRow!.organizationId).toBe(testOrgId);

    // 2. Journal persistido bajo orgId — cableo scope.journalEntries→tx outer.
    const journalRow = await prisma.journalEntry.findUnique({
      where: { id: result.journalId },
    });
    expect(journalRow).not.toBeNull();
    expect(journalRow!.organizationId).toBe(testOrgId);

    // 3. Audit row con correlationId pre-tx + changedById SET LOCAL —
    //    invariantes withAuditTx vivas a través del PurchaseScope.
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId, organizationId: testOrgId },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.every((r) => r.changedById === testUserId)).toBe(true);
  });

  it("rollback: fn throws after scope.purchases.saveTx + scope.journalEntries.create → ningún purchase, journal ni audit persiste", async () => {
    const uow = new PrismaPurchaseUnitOfWork(
      repo,
      journalEntriesReadPort,
      accountLookupPort,
      autoEntryGen,
      () => ivaBooksService,
    );
    const draftPurchase = buildDraftPurchase();
    const draftJournal = buildDraftJournal();
    let scopeIdBeforeThrow: string | undefined;
    const boom = new Error("rollback-me");

    await expect(
      uow.run(
        { userId: testUserId, organizationId: testOrgId },
        async (scope) => {
          scopeIdBeforeThrow = scope.correlationId;
          await scope.purchases.saveTx(draftPurchase);
          await scope.journalEntries.create(draftJournal);
          throw boom;
        },
      ),
    ).rejects.toBe(boom);

    expect(scopeIdBeforeThrow).toBeDefined();
    capturedCorrelationIds.push(scopeIdBeforeThrow!);

    // Si scope.purchases usara tx distinta al outer, purchase sobreviviría.
    const purchases = await prisma.purchase.findMany({
      where: { organizationId: testOrgId },
    });
    expect(purchases.length).toBe(0);

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

  it("E3 cleanup integration mirror: __resetForTesting() callable + UoW ctor 6-arg uniform hex shape with ivaScopeFactory dep (forward C3 GREEN cleanup target)", async () => {
    // RED honesty C3 (feedback/red-acceptance-failure-mode):
    // **Primary file-level RED**: 2 callsites legacy 5-arg en este archivo
    // (commit + rollback tests L257, L306) — TS2554 transient pre-cleanup
    // `Expected 6 arguments, but got 5`. C3 GREEN cleanup uniformly updates
    // → 6-arg hex (+ivaScopeFactory dep). **Secondary runtime RED**: 2
    // legacy callsites runtime-fail si vitest ejecuta sin TS check (esbuild
    // strip), porque UoW.run construye adapter con 6-arg post-C2 GREEN —
    // legacy 5-arg passes undefined a slot 6 (ivaScopeFactory) → adapter
    // body invoca `this.ivaScopeFactory(...)` → TypeError "is not a function".
    //
    // **Tertiary E3 self**: usa NEW 6-arg shape POST-C2 GREEN (a515636) —
    // E3 self pasa como SEED documenting cleanup target. RED honesty
    // declarada via file-level transients pending GREEN.
    //
    // **`__resetForTesting()` integration**: validates iva root memo reset
    // hook callable from this test context (P4 (ii) lockeada Marco). C3
    // GREEN cleanup adds `beforeEach(() => __resetForTesting())` para test
    // isolation cross-test.
    //
    // Mirror simétrico estricto sale UoW E3.
    __resetForTesting();
    expect(typeof __resetForTesting).toBe("function");

    const mockHexService = {
      recomputeFromPurchaseCascade: async (
        _input: unknown,
        _scope: IvaBookScope,
      ): Promise<void> => {},
    } as unknown as IvaBookService;

    const mockScopeFactory = (
      _tx: Prisma.TransactionClient,
      correlationId: string,
    ): IvaBookScope =>
      ({
        correlationId,
        fiscalPeriods: undefined as never,
        ivaSalesBooks: undefined as never,
        ivaPurchaseBooks: undefined as never,
      }) as unknown as IvaBookScope;

    // Smoke cleanup target: 6-arg ctor hex shape uniform en file (post-C3
    // GREEN cleanup). Pre-cleanup: 2 callsites legacy 5-arg coexisten con
    // este E3 6-arg en mismo file → file inconsistency cleanup-pending.
    const uow = new PrismaPurchaseUnitOfWork(
      repo,
      journalEntriesReadPort,
      accountLookupPort,
      autoEntryGen,
      () => mockHexService,
      mockScopeFactory,
    );

    expect(uow).toBeInstanceOf(PrismaPurchaseUnitOfWork);
  });
});
