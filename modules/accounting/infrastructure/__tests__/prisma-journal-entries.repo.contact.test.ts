import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaJournalLedgerQueryAdapter } from "../prisma-journal-ledger-query.adapter";

/**
 * Adapter contract for the contact-keyed libro reads (contact-ledger-refactor
 * — C2). Mirror of the sister account-keyed integration test, one layer over:
 * `findLinesByContactPaginated` / `findOpeningBalanceByContact` /
 * `aggregateOpenBalanceByContact`.
 *
 * RED expected failure mode per [[red_acceptance_failure_mode]]:
 *   `PrismaJournalLedgerQueryAdapter` C1 stubs throw `Error("... not
 *   implemented (C2 pending)")` from all 3 methods. Per lección C1, the RED
 *   targets the SAME runtime object that gains the real behaviour in GREEN
 *   (the adapter, where stubs exist) — NOT a bare-object cast and NOT
 *   `JournalRepository` (which has no surface yet). GREEN adds the 3 methods
 *   to `JournalRepository` mirroring the sister Account variants and rewires
 *   the adapter pass-through; tests turn green via real Prisma SQL.
 *
 * Failure assertion: `.rejects.toThrow(/not implemented/)` on each method.
 *
 * Postgres-real integration test — same pattern as
 * `prisma-journal-entries.repo.integration.test.ts`. Fixtures: User + Org +
 * FiscalPeriod (year 2098, OPEN) + VoucherType + 2 Accounts + 1 Contact.
 * Cleanup follows the same FK-safe order as the sister file plus
 * `contacts.deleteMany` (added because we seed a contact fixture).
 *
 * DEC-1 boundary: adapter returns decimal-coercible primitives (string for
 * scalar opening balance; Prisma.Decimal-or-string for line debit/credit and
 * `openingBalanceDelta` per port `unknown` boundary). Service wraps with
 * `new Decimal(String(...))` per DEC-1.
 */

describe("PrismaJournalLedgerQueryAdapter — contact-keyed reads (Postgres integration)", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let assetAccountId: string;
  let liabilityAccountId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pjer-contact-test-clerk-user-${stamp}`,
        email: `pjer-contact-test-${stamp}@test.local`,
        name: "PrismaJournalEntriesRepository Contact Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pjer-contact-test-clerk-org-${stamp}`,
        name: `PrismaJournalEntriesRepository Contact Integration Test Org ${stamp}`,
        slug: `pjer-contact-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pjer-contact-integration-period",
        year: 2098,
        month: 1,
        startDate: new Date("2098-01-01T00:00:00Z"),
        endDate: new Date("2098-01-31T23:59:59Z"),
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
        code: "1100",
        name: "Cuentas por Cobrar",
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
        code: "4000",
        name: "Ingresos por Ventas",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
      },
    });
    liabilityAccountId = liability.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        type: "CLIENTE",
        name: "Cliente Test Contact C2",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
  });

  afterAll(async () => {
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
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

  /**
   * Helper: POSTED journal entry with TWO lines on asset+liability accounts.
   * `contactPlacement` controls D4 surface:
   *   - "header": `journal_entries.contactId = X` (auto entries from CxC/CxP).
   *   - "line":   one line carries `contactId = X` (asiento manual con auxiliar).
   *   - "none":   no contact reference at all (asiento manual sin auxiliar — D4
   *               flagging happens in service post-hoc).
   * `lineContactSide` controls which line carries the contactId when
   * placement="line": "debit" puts it on the asset line, "credit" on liability.
   */
  async function postedEntry(opts: {
    number: number;
    date: Date;
    debit: number;
    credit: number;
    contactPlacement: "header" | "line" | "none";
    lineContactSide?: "debit" | "credit";
  }): Promise<string> {
    const headerContactId =
      opts.contactPlacement === "header" ? testContactId : null;
    const debitLineContactId =
      opts.contactPlacement === "line" &&
      (opts.lineContactSide ?? "debit") === "debit"
        ? testContactId
        : null;
    const creditLineContactId =
      opts.contactPlacement === "line" && opts.lineContactSide === "credit"
        ? testContactId
        : null;

    const entry = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        number: opts.number,
        date: opts.date,
        description: `contact-${opts.number}`,
        status: "POSTED",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        createdById: testUserId,
        contactId: headerContactId,
      },
    });
    await prisma.journalLine.create({
      data: {
        journalEntryId: entry.id,
        accountId: assetAccountId,
        debit: new Prisma.Decimal(opts.debit),
        credit: new Prisma.Decimal(0),
        order: 0,
        contactId: debitLineContactId,
      },
    });
    await prisma.journalLine.create({
      data: {
        journalEntryId: entry.id,
        accountId: liabilityAccountId,
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(opts.credit),
        order: 1,
        contactId: creditLineContactId,
      },
    });
    return entry.id;
  }

  it("findLinesByContactPaginated: returns ContactLedgerPageResult with header-keyed AND line-keyed lines + openingBalanceDelta", async () => {
    // Universe:
    //   - 1 historical POSTED entry (header-contactId, balanced 100/100) before dateFrom
    //   - 1 historical POSTED entry contactPlacement="none" (must be EXCLUDED)
    //   - 1 in-range POSTED entry header-contactId (balanced 200/200)
    //   - 1 in-range POSTED entry line-contactId on the credit side
    //   - 1 in-range POSTED entry contactPlacement="none" (must be EXCLUDED)
    await postedEntry({
      number: 1,
      date: new Date("2098-01-05"),
      debit: 100,
      credit: 100,
      contactPlacement: "header",
    });
    await postedEntry({
      number: 2,
      date: new Date("2098-01-07"),
      debit: 999,
      credit: 999,
      contactPlacement: "none",
    });
    await postedEntry({
      number: 3,
      date: new Date("2098-01-20"),
      debit: 200,
      credit: 200,
      contactPlacement: "header",
    });
    await postedEntry({
      number: 4,
      date: new Date("2098-01-22"),
      debit: 0,
      credit: 50,
      contactPlacement: "line",
      lineContactSide: "credit",
    });
    await postedEntry({
      number: 5,
      date: new Date("2098-01-25"),
      debit: 777,
      credit: 777,
      contactPlacement: "none",
    });

    const adapter = new PrismaJournalLedgerQueryAdapter();
    const result = await adapter.findLinesByContactPaginated(
      testOrgId,
      testContactId,
      { dateRange: { dateFrom: new Date("2098-01-15") } },
      { page: 1, pageSize: 25 },
    );

    // In-range lines reachable via either contact surface:
    //   entry 3 (header surface) → 2 lines (debit 200 asset + credit 200 liability)
    //   entry 4 (line surface)   → 1 line (credit 50 liability — the asset line
    //                              has no contactId AND the header has no
    //                              contactId, so only the credit line surfaces)
    // Total = 3.
    expect(result.total).toBe(3);
    expect(result.items.length).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.totalPages).toBe(1);

    // openingBalanceDelta historical contribution = entry 1 (header):
    //   asset debit 100 + liability credit 100 → net 0.
    const opening = new Prisma.Decimal(String(result.openingBalanceDelta));
    expect(opening.toString()).toBe("0");

    // ContactLedgerLineRow shape: sourceType + sourceId carried from JournalEntry.
    for (const row of result.items) {
      expect(row).toHaveProperty("sourceType");
      expect(row).toHaveProperty("sourceId");
      expect(row).toHaveProperty("journalEntry");
      expect(row.journalEntry).toHaveProperty("voucherType");
    }

    // Lines from the "none" entries (2 + 5) MUST NOT appear.
    const debits = result.items.map((r) => String(r.debit));
    expect(debits).not.toContain("999");
    expect(debits).not.toContain("777");
  });

  it("findOpeningBalanceByContact: returns scalar sum(debit-credit) of contact lines BEFORE dateFrom as a Decimal-coercible primitive", async () => {
    // Historical (< 2098-01-15):
    //   entry 10 header → asset debit 300 + liability credit 300 → header
    //                    surface includes both → net 0
    //   entry 11 line (debit side only) → asset debit 80, no header contactId,
    //                    only the asset line carries contactId → net +80
    //   entry 12 none → excluded
    // In-range (>= 2098-01-15):
    //   entry 13 header (unbalanced for visibility) → excluded by dateFrom
    await postedEntry({
      number: 10,
      date: new Date("2098-01-03"),
      debit: 300,
      credit: 300,
      contactPlacement: "header",
    });
    await postedEntry({
      number: 11,
      date: new Date("2098-01-04"),
      debit: 80,
      credit: 80,
      contactPlacement: "line",
      lineContactSide: "debit",
    });
    await postedEntry({
      number: 12,
      date: new Date("2098-01-05"),
      debit: 555,
      credit: 555,
      contactPlacement: "none",
    });
    await postedEntry({
      number: 13,
      date: new Date("2098-01-20"),
      debit: 999,
      credit: 0,
      contactPlacement: "header",
    });

    const adapter = new PrismaJournalLedgerQueryAdapter();
    const opening = await adapter.findOpeningBalanceByContact(
      testOrgId,
      testContactId,
      new Date("2098-01-15"),
    );

    // Coercible primitive per DEC-1 port boundary.
    const decimal = new Prisma.Decimal(String(opening));
    // Header surface entry 10: debit 300 + credit 300 → 0.
    // Line surface entry 11: debit 80 (asset line only) → +80.
    // Total opening = 80.
    expect(decimal.toString()).toBe("80");
  });

  it("aggregateOpenBalanceByContact: returns LedgerAggregateRow with ALL-TIME sums of contact lines (NOT period-scoped)", async () => {
    // Three entries spread across the period:
    //   entry 20 header → asset debit 100 + liability credit 100 (header
    //                    surface adds both lines)
    //   entry 21 line (debit side) → asset debit 50
    //   entry 22 none → excluded
    await postedEntry({
      number: 20,
      date: new Date("2098-01-02"),
      debit: 100,
      credit: 100,
      contactPlacement: "header",
    });
    await postedEntry({
      number: 21,
      date: new Date("2098-01-15"),
      debit: 50,
      credit: 50,
      contactPlacement: "line",
      lineContactSide: "debit",
    });
    await postedEntry({
      number: 22,
      date: new Date("2098-01-25"),
      debit: 444,
      credit: 444,
      contactPlacement: "none",
    });

    const adapter = new PrismaJournalLedgerQueryAdapter();
    const aggregate = await adapter.aggregateOpenBalanceByContact(
      testOrgId,
      testContactId,
    );

    expect(aggregate).toHaveProperty("_sum");
    const debit = new Prisma.Decimal(String(aggregate._sum.debit ?? 0));
    const credit = new Prisma.Decimal(String(aggregate._sum.credit ?? 0));
    // Header surface entry 20: debit 100, credit 100.
    // Line surface entry 21: debit 50.
    // Excluded entry 22.
    // Total: debit = 150; credit = 100.
    expect(debit.toString()).toBe("150");
    expect(credit.toString()).toBe("100");
  });
});
