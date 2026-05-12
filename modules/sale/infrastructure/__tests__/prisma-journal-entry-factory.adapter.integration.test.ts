import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import {
  ACCOUNT_NOT_POSTABLE,
  JOURNAL_NOT_BALANCED,
  NotFoundError,
  VOUCHER_TYPE_NOT_IN_ORG,
} from "@/features/shared/errors";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import { LegacyJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/legacy-journal-entries-read.adapter";
import { PrismaJournalEntriesRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import type { SaleJournalTemplate } from "@/modules/sale/domain/ports/journal-entry-factory.port";

import { PrismaJournalEntryFactoryAdapter } from "../prisma-journal-entry-factory.adapter";

/**
 * Postgres-real integration test for PrismaJournalEntryFactoryAdapter (POC
 * #11.0a A3 Ciclo 4). DATABASE_URL = dev DB. Strict cleanup by orgId fixtures.
 *
 * Fixtures (`beforeAll`): User + Org + FiscalPeriod (year 2099, OPEN) +
 * VoucherTypeCfg `code: "CI"` (adapter hardcode mirror legacy `sale.service.ts`
 * l333/475) + 5 Accounts (cxc 1100, income 4100, extra 9000, new 5000 — all
 * ACTIVE/DETAIL — and inactive 9999) + Contact.
 *
 * Cleanup mirror C3-B (`prisma-journal-entries.repo.integration.test.ts`):
 *   - paso 0: journal_lines explícito ANTES de journal_entries (defensa
 *     trigger AFTER DELETE consulta padre `journal_entries`).
 *   - paso 5: voucher_types eliminadas (heredado C3-B).
 *   - paso 3: audit_logs by orgId (captura triggers `audit_journal_entries`,
 *     `audit_journal_lines`, etc).
 *
 * Locks Ciclo 4:
 *   - D-2 (c2): adapter constructor `(tx, readPort, lookupPort, writeRepo,
 *     autoEntryGen)` — composition root cablea cross-module sub-deps.
 *   - D-3 α §13 emergente: `regenerateForSaleEdit` lee old via
 *     `readPort.findById` NON-TX (drift vs legacy `sale.service.ts:1091`
 *     que lee in-tx). Safe: old journal no co-mutado pre-write en la misma
 *     tx. Port doc + use case A2 Ciclo 6b ya cerrados.
 */

describe("PrismaJournalEntryFactoryAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let cxcAccountId: string; // code 1100, ACTIVE, DETAIL — DEBIT side sales
  let incomeAccountId: string; // code 4100, ACTIVE, DETAIL — CREDIT side sales
  let extraAccountId: string; // code 9000, ACTIVE, DETAIL — T8 line C (replaced)
  let newAccountId: string; // code 5000, ACTIVE, DETAIL — T8 line D (replacement)
  let inactiveAccountId: string; // code 9999, INACTIVE — T3 negative path
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pjef-test-clerk-user-${stamp}`,
        email: `pjef-test-${stamp}@test.local`,
        name: "PrismaJournalEntryFactoryAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pjef-test-clerk-org-${stamp}`,
        name: `PJEFA Integration Test Org ${stamp}`,
        slug: `pjef-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pjef-integration-period",
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
        code: "CI",
        prefix: "C",
        name: "Comprobante de Ingresos",
        isActive: true,
        isAdjustment: false,
      },
    });
    testVoucherTypeId = voucherType.id;

    const cxc = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "1100",
        name: "CxC Account",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 1,
        isDetail: true,
        isActive: true,
      },
    });
    cxcAccountId = cxc.id;

    const income = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "4100",
        name: "Income Account",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
        isActive: true,
      },
    });
    incomeAccountId = income.id;

    const extra = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "9000",
        name: "Extra Account (T8 line C)",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
        isActive: true,
      },
    });
    extraAccountId = extra.id;

    const newAcc = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "5000",
        name: "New Account (T8 line D)",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
        isActive: true,
      },
    });
    newAccountId = newAcc.id;

    const inactive = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "9999",
        name: "Inactive Account",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
        isActive: false,
      },
    });
    inactiveAccountId = inactive.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Customer",
        type: "CLIENTE",
        nit: "9876543",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Aislamiento entre tests del mismo describe — child antes de padre por
    // trigger AFTER DELETE de journal_lines (mirror C3-B paso 0).
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
  });

  afterAll(async () => {
    // FK-safe order, paso 0/3/5 heredados C3-B:
    //   1. journal_lines (paso 0 — defensa explícita pre-trigger)
    //   2. journal_entries
    //   3. accounts
    //   4. voucher_types (paso 5 heredado C3-B)
    //   5. contacts
    //   6. fiscal_period
    //   7. audit_logs (paso 3 — captura triggers)
    //   8. organization
    //   9. user
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.voucherTypeCfg.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  function buildAdapter(
    tx: Prisma.TransactionClient,
  ): PrismaJournalEntryFactoryAdapter {
    const readPort = new LegacyJournalEntriesReadAdapter();
    const lookupPort = new LegacyAccountLookupAdapter();
    const writeRepo = new PrismaJournalEntriesRepository(tx);
    const autoEntryGen = new AutoEntryGenerator(
      new PrismaAccountsRepo(),
      makeVoucherTypeRepository(),
    );
    return new PrismaJournalEntryFactoryAdapter(
      tx,
      readPort,
      lookupPort,
      writeRepo,
      autoEntryGen,
    );
  }

  function buildSaleTemplate(
    overrides?: Partial<SaleJournalTemplate>,
  ): SaleJournalTemplate {
    return {
      organizationId: testOrgId,
      contactId: testContactId,
      date: new Date("2099-01-15T12:00:00Z"),
      periodId: testPeriodId,
      description: "VG-001 - Test Sale",
      sourceType: "sale" as const,
      sourceId: "sale-test-id-001",
      createdById: testUserId,
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT" as const,
          amount: 100,
          contactId: testContactId,
          description: "CxC line",
        },
        {
          accountCode: "4100",
          side: "CREDIT" as const,
          amount: 100,
          description: "Income line",
        },
      ],
      ...overrides,
    };
  }

  async function seedJournalDirect(
    lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      order: number;
      description?: string;
      contactId?: string;
    }>,
    sequenceNumber = 1,
  ): Promise<string> {
    const created = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        date: new Date("2099-01-15T12:00:00Z"),
        description: "Pre-existing journal for regenerate test",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        contactId: testContactId,
        sourceType: "sale",
        sourceId: `sale-pre-existing-${sequenceNumber}`,
        createdById: testUserId,
        status: "POSTED",
        number: sequenceNumber,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: new Prisma.Decimal(l.debit),
            credit: new Prisma.Decimal(l.credit),
            order: l.order,
            description: l.description,
            contactId: l.contactId,
          })),
        },
      },
    });
    return created.id;
  }

  // ── Tests `generateForSale` (4) ───────────────────────────────────────────

  it("generateForSale: persists POSTED journal with balanced lines and returns aggregate hydrated from DB", async () => {
    // RED honesty preventivo: pre-GREEN FAILS por module resolution
    // (`../prisma-journal-entry-factory.adapter` no existe). Post-GREEN:
    // adapter mapea SaleJournalTemplate → EntryTemplate legacy con
    // voucherTypeCode "CI" hardcoded → AutoEntryGenerator.generate(this.tx, ...)
    // → hydrateJournalFromRow. Status POSTED paridad legacy.
    const template = buildSaleTemplate();

    const result = await prisma.$transaction(async (tx) => {
      const adapter = buildAdapter(tx);
      return adapter.generateForSale(template);
    });

    expect(result.id).toBeDefined();
    expect(result.organizationId).toBe(testOrgId);
    expect(result.status).toBe("POSTED");
    expect(result.lines).toHaveLength(2);

    const row = await prisma.journalEntry.findUnique({
      where: { id: result.id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("POSTED");
    expect(row!.voucherTypeId).toBe(testVoucherTypeId);
    expect(row!.sourceType).toBe("sale");
    expect(row!.sourceId).toBe("sale-test-id-001");
    expect(row!.contactId).toBe(testContactId);
    expect(row!.lines).toHaveLength(2);
    expect(row!.lines[0].accountId).toBe(cxcAccountId);
    expect(row!.lines[0].debit.toString()).toBe("100");
    expect(row!.lines[0].credit.toString()).toBe("0");
    expect(row!.lines[0].order).toBe(0);
    expect(row!.lines[1].accountId).toBe(incomeAccountId);
    expect(row!.lines[1].debit.toString()).toBe("0");
    expect(row!.lines[1].credit.toString()).toBe("100");
    expect(row!.lines[1].order).toBe(1);
  });

  it("generateForSale: voucherType CI missing → ValidationError VOUCHER_TYPE_NOT_IN_ORG", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    // AutoEntryGenerator step 1 lookup voucherType "CI" returns null →
    // ValidationError VOUCHER_TYPE_NOT_IN_ORG (mirror legacy l63).
    await prisma.voucherTypeCfg.deleteMany({
      where: { organizationId: testOrgId, code: "CI" },
    });

    try {
      const template = buildSaleTemplate();

      await expect(
        prisma.$transaction(async (tx) => {
          const adapter = buildAdapter(tx);
          return adapter.generateForSale(template);
        }),
      ).rejects.toMatchObject({ code: VOUCHER_TYPE_NOT_IN_ORG });
    } finally {
      // Restaurar VoucherTypeCfg "CI" para tests subsiguientes (T3/T4/T5/T7/T8
      // necesitan el voucherType configurado).
      const restored = await prisma.voucherTypeCfg.create({
        data: {
          organizationId: testOrgId,
          code: "CI",
          prefix: "C",
          name: "Comprobante de Ingresos",
          isActive: true,
          isAdjustment: false,
        },
      });
      testVoucherTypeId = restored.id;
    }
  });

  it("generateForSale: accountCode points to inactive account → ValidationError ACCOUNT_NOT_POSTABLE", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    // AutoEntryGenerator step 2 detects account.isActive=false → ValidationError
    // ACCOUNT_NOT_POSTABLE (mirror legacy l88). `inactiveAccountId` está
    // configurada con isActive:false en fixtures.
    void inactiveAccountId; // referenciado vía code "9999" en template
    const template = buildSaleTemplate({
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT",
          amount: 100,
          contactId: testContactId,
          description: "CxC",
        },
        {
          accountCode: "9999",
          side: "CREDIT",
          amount: 100,
          description: "Inactive credit",
        },
      ],
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const adapter = buildAdapter(tx);
        return adapter.generateForSale(template);
      }),
    ).rejects.toMatchObject({ code: ACCOUNT_NOT_POSTABLE });
  });

  it("generateForSale: lines do not balance → ValidationError JOURNAL_NOT_BALANCED", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    // AutoEntryGenerator step 3 detects sum(debit) !== sum(credit) →
    // ValidationError JOURNAL_NOT_BALANCED (mirror legacy l116).
    const template = buildSaleTemplate({
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT",
          amount: 100,
          contactId: testContactId,
          description: "CxC",
        },
        {
          accountCode: "4100",
          side: "CREDIT",
          amount: 50,
          description: "Income unbalanced",
        },
      ],
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const adapter = buildAdapter(tx);
        return adapter.generateForSale(template);
      }),
    ).rejects.toMatchObject({ code: JOURNAL_NOT_BALANCED });
  });

  // ── Tests `regenerateForSaleEdit` (4) ─────────────────────────────────────

  it("regenerateForSaleEdit: loads old, replaces lines, persists, returns {old, new} with same id", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    //   1. readPort.findById hidrata `old` Journal NON-TX (D-3 α §13 emergente)
    //   2. lookupPort.findManyByCodes resuelve code → id para newLines
    //   3. aggregate.update().replaceLines() muta in-memory
    //   4. writeRepo.update(updated, {replaceLines:true}) persiste
    //   5. Return {old, new} con new.id === old.id (UPDATE preserva id; lines
    //      delete-and-recreate via `repo.updateTx` paridad legacy).
    const oldId = await seedJournalDirect([
      {
        accountId: cxcAccountId,
        debit: 100,
        credit: 0,
        order: 0,
        description: "Old DEBIT",
      },
      {
        accountId: incomeAccountId,
        debit: 0,
        credit: 100,
        order: 1,
        description: "Old CREDIT",
      },
    ]);
    const template = buildSaleTemplate({
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT",
          amount: 200,
          contactId: testContactId,
          description: "New DEBIT",
        },
        {
          accountCode: "4100",
          side: "CREDIT",
          amount: 200,
          description: "New CREDIT",
        },
      ],
    });

    const result = await prisma.$transaction(async (tx) => {
      const adapter = buildAdapter(tx);
      return adapter.regenerateForSaleEdit(oldId, template);
    });

    // old aggregate: lines previas con amount 100
    expect(result.old.id).toBe(oldId);
    expect(result.old.lines).toHaveLength(2);

    // new aggregate: same id (UPDATE preserves), lines reemplazadas con amount 200
    expect(result.new.id).toBe(oldId);
    expect(result.new.lines).toHaveLength(2);

    // DB verify: row UPDATED, lines reemplazadas con amounts del template
    const row = await prisma.journalEntry.findUnique({
      where: { id: oldId },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row).not.toBeNull();
    expect(row!.lines).toHaveLength(2);
    expect(row!.lines[0].debit.toString()).toBe("200");
    expect(row!.lines[0].credit.toString()).toBe("0");
    expect(row!.lines[1].debit.toString()).toBe("0");
    expect(row!.lines[1].credit.toString()).toBe("200");
  });

  it("regenerateForSaleEdit: oldJournalId not found → NotFoundError(\"Asiento contable\")", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    // readPort.findById returns null when entry doesn't exist → adapter throws
    // NotFoundError("Asiento contable") (mirror legacy parity).
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const template = buildSaleTemplate();

    await expect(
      prisma.$transaction(async (tx) => {
        const adapter = buildAdapter(tx);
        return adapter.regenerateForSaleEdit(nonExistentId, template);
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("regenerateForSaleEdit: accountCode in template not found in org → ValidationError ACCOUNT_NOT_POSTABLE", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    // lookupPort.findManyByCodes returns subset (only found accounts). Adapter
    // detects missing code → ValidationError ACCOUNT_NOT_POSTABLE (mirror
    // legacy l88 paridad — incluye caso "no encontrada").
    const oldId = await seedJournalDirect([
      {
        accountId: cxcAccountId,
        debit: 100,
        credit: 0,
        order: 0,
        description: "Old DEBIT",
      },
      {
        accountId: incomeAccountId,
        debit: 0,
        credit: 100,
        order: 1,
        description: "Old CREDIT",
      },
    ]);
    const template = buildSaleTemplate({
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT",
          amount: 100,
          contactId: testContactId,
          description: "Existing",
        },
        {
          accountCode: "INEXISTENT-XYZ",
          side: "CREDIT",
          amount: 100,
          description: "Missing code",
        },
      ],
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const adapter = buildAdapter(tx);
        return adapter.regenerateForSaleEdit(oldId, template);
      }),
    ).rejects.toMatchObject({ code: ACCOUNT_NOT_POSTABLE });
  });

  it("regenerateForSaleEdit: replaceLines bit-exact — old line removed, new line created with template fields preserved", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN:
    // writeRepo.update con replaceLines:true ejecuta deleteMany + createMany
    // sobre journal_lines (paridad legacy `repo.updateTx`). Verificamos:
    // line con code "9000" (extra) borrada, line con code "5000" (newAccount)
    // creada con order/description del template.
    void newAccountId; // referenciado vía code "5000" en template
    const oldId = await seedJournalDirect([
      {
        accountId: cxcAccountId,
        debit: 100,
        credit: 0,
        order: 0,
        description: "A: CxC",
      },
      {
        accountId: incomeAccountId,
        debit: 0,
        credit: 60,
        order: 1,
        description: "B: Income",
      },
      {
        accountId: extraAccountId,
        debit: 0,
        credit: 40,
        order: 2,
        description: "C: Extra (will be replaced)",
      },
    ]);
    const template = buildSaleTemplate({
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT",
          amount: 100,
          contactId: testContactId,
          description: "A: CxC",
        },
        {
          accountCode: "4100",
          side: "CREDIT",
          amount: 60,
          description: "B: Income",
        },
        {
          accountCode: "5000",
          side: "CREDIT",
          amount: 40,
          description: "D: New",
        },
      ],
    });

    await prisma.$transaction(async (tx) => {
      const adapter = buildAdapter(tx);
      return adapter.regenerateForSaleEdit(oldId, template);
    });

    const row = await prisma.journalEntry.findUnique({
      where: { id: oldId },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    expect(row).not.toBeNull();
    expect(row!.lines).toHaveLength(3);

    const accountIds = row!.lines.map((l) => l.accountId);
    expect(accountIds).toContain(cxcAccountId);
    expect(accountIds).toContain(incomeAccountId);
    expect(accountIds).toContain(newAccountId);
    expect(accountIds).not.toContain(extraAccountId);

    // Order, description preserved from template; amount 40 maps a credit
    // (side=CREDIT) en code "5000".
    const newLine = row!.lines.find((l) => l.accountId === newAccountId)!;
    expect(newLine.order).toBe(2);
    expect(newLine.description).toBe("D: New");
    expect(newLine.credit.toString()).toBe("40");
    expect(newLine.debit.toString()).toBe("0");
  });
});
