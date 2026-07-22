import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { AutoEntryGenerator } from "@/modules/accounting/application/auto-entry-generator";
import { AutoEntryJournalWriterAdapter } from "@/modules/accounting/infrastructure/adapters/auto-entry-journal-writer.adapter";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import { prisma } from "@/lib/prisma";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { PrismaJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/prisma-journal-entries-read.adapter";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { PrismaOperationalDocTypesRepository } from "@/modules/operational-doc-type/presentation/server";
import { Purchase } from "@/modules/purchase/domain/purchase.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Money } from "@/modules/shared/domain/value-objects/money";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { PrismaPurchaseUnitOfWork } from "../prisma-purchase-unit-of-work";

/**
 * Postgres-real integration test for PrismaPurchaseUnitOfWork.
 *
 * Validates that `scope.purchases.saveTx` and `scope.journalEntries.create`
 * share the same tx outer opened by `withAuditTx`.
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

const journalEntriesReadPort = new PrismaJournalEntriesReadAdapter();
const accountLookupPort = new LegacyAccountLookupAdapter();
const autoEntryGen = new AutoEntryGenerator(
  new PrismaAccountsRepo(),
  makeVoucherTypeRepository(),
  new AutoEntryJournalWriterAdapter(),
);
// journal-physical-document Phase 6 — Purchase UoW requires the
// OperationalDocType lookup repo for FL/PF/CG/SV FK resolution.
const operationalDocTypesRepo = new PrismaOperationalDocTypesRepository();

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
      operationalDocTypesRepo,
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
      operationalDocTypesRepo,
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

  it("smoke: UoW instantiates with 4-arg ctor (post-LCV-retirement)", () => {
    const uow = new PrismaPurchaseUnitOfWork(
      repo,
      journalEntriesReadPort,
      accountLookupPort,
      autoEntryGen,
      operationalDocTypesRepo,
    );
    expect(uow).toBeInstanceOf(PrismaPurchaseUnitOfWork);
  });
});
