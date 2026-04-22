/**
 * Phase 3 — MonthlyCloseRepository integration tests (cierre-periodo).
 *
 * Exercises the real Postgres test DB (no mocks). Fixture state is shared
 * across describe blocks via a top-level beforeAll/afterAll pair; each `it`
 * seeds its own row subset as needed and cleans up mutations after.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { MonthlyCloseRepository } from "../monthly-close.repository";

const repo = new MonthlyCloseRepository();

// ── Shared fixture state ──────────────────────────────────────────────────────

let orgId: string;
let userId: string;
let periodAId: string; // primary period under test
let periodBId: string; // isolation target
let voucherTypeId: string;
let contactId: string;
let accountDebitId: string;
let accountCreditId: string;

beforeAll(async () => {
  const now = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-mc-repo-${now}`,
      email: `mc-repo-${now}@test.com`,
      name: "MC Repo Test",
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `clerk-mc-repo-${now}`,
      slug: `mc-repo-${now}`,
      name: "MC Repo Org",
    },
  });
  orgId = org.id;

  const periodA = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `Período A ${now}`,
      year: 2026,
      month: 1,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodAId = periodA.id;

  const periodB = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `Período B ${now}`,
      year: 2026,
      month: 2,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-02-28"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodBId = periodB.id;

  const vt = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-MC-${now}`,
      prefix: "CI",
      name: "Comprobante Ingreso",
    },
  });
  voucherTypeId = vt.id;

  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      type: "CLIENTE",
      name: "Cliente Test MC",
    },
  });
  contactId = contact.id;

  const accountDebit = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.1.1-MC-${now}`,
      name: "Cuenta Deudora MC",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
    },
  });
  accountDebitId = accountDebit.id;

  const accountCredit = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `3.1.1-MC-${now}`,
      name: "Cuenta Acreedora MC",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
    },
  });
  accountCreditId = accountCredit.id;
});

afterAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } });
  await prisma.dispatch.deleteMany({ where: { organizationId: orgId } });
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.sale.deleteMany({ where: { organizationId: orgId } });
  await prisma.purchase.deleteMany({ where: { organizationId: orgId } });
  await prisma.account.deleteMany({ where: { organizationId: orgId } });
  await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

// ── Per-test mutation cleanup helper ──────────────────────────────────────────

async function wipePerTestMutations() {
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } });
  await prisma.dispatch.deleteMany({ where: { organizationId: orgId } });
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.sale.deleteMany({ where: { organizationId: orgId } });
  await prisma.purchase.deleteMany({ where: { organizationId: orgId } });
  // Reset period A state in case a test closed it
  await prisma.fiscalPeriod.update({
    where: { id: periodAId },
    data: { status: "OPEN", closedAt: null, closedBy: null },
  });
}

// ── T10 — countDraftDocuments ─────────────────────────────────────────────────

describe("MonthlyCloseRepository.countDraftDocuments (T10)", () => {
  afterEach(async () => {
    await wipePerTestMutations();
  });

  it("countDraftDocuments returns per-entity counts when drafts exist", async () => {
    await prisma.dispatch.create({
      data: {
        organizationId: orgId,
        dispatchType: "NOTA_DESPACHO",
        status: "DRAFT",
        sequenceNumber: 1,
        date: new Date("2026-01-10"),
        contactId,
        periodId: periodAId,
        description: "Draft dispatch",
        totalAmount: "100.00",
        createdById: userId,
      },
    });

    await prisma.payment.create({
      data: {
        organizationId: orgId,
        status: "DRAFT",
        method: "EFECTIVO",
        date: new Date("2026-01-10"),
        amount: "50.00",
        description: "Draft payment",
        periodId: periodAId,
        contactId,
        createdById: userId,
      },
    });

    await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId: periodAId,
        createdById: userId,
        number: 1,
        date: new Date("2026-01-10"),
        description: "Draft JE",
        status: "DRAFT",
      },
    });

    const result = await repo.countDraftDocuments(orgId, periodAId);
    expect(result).toEqual({ dispatches: 1, payments: 1, journalEntries: 1 });
  });

  it("countDraftDocuments returns zeros for period with no drafts", async () => {
    const result = await repo.countDraftDocuments(orgId, periodAId);
    expect(result).toEqual({ dispatches: 0, payments: 0, journalEntries: 0 });
  });

  it("countDraftDocuments is isolated to periodId", async () => {
    await prisma.dispatch.create({
      data: {
        organizationId: orgId,
        dispatchType: "NOTA_DESPACHO",
        status: "DRAFT",
        sequenceNumber: 2,
        date: new Date("2026-02-10"),
        contactId,
        periodId: periodBId,
        description: "Draft dispatch B",
        totalAmount: "100.00",
        createdById: userId,
      },
    });

    const resultA = await repo.countDraftDocuments(orgId, periodAId);
    expect(resultA).toEqual({ dispatches: 0, payments: 0, journalEntries: 0 });

    const resultB = await repo.countDraftDocuments(orgId, periodBId);
    expect(resultB.dispatches).toBe(1);
  });
});

// ── T12 — sumDebitCredit ──────────────────────────────────────────────────────

describe("MonthlyCloseRepository.sumDebitCredit (T12)", () => {
  afterEach(async () => {
    await wipePerTestMutations();
  });

  it("sumDebitCredit returns equal Decimals for balanced POSTED entries", async () => {
    const je1 = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId: periodAId,
        createdById: userId,
        number: 10,
        date: new Date("2026-01-05"),
        description: "Balanced JE 1",
        status: "POSTED",
      },
    });
    await prisma.journalLine.createMany({
      data: [
        { journalEntryId: je1.id, accountId: accountDebitId, debit: "100", credit: "0" },
        { journalEntryId: je1.id, accountId: accountCreditId, debit: "0", credit: "100" },
      ],
    });

    const je2 = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId: periodAId,
        createdById: userId,
        number: 11,
        date: new Date("2026-01-06"),
        description: "Balanced JE 2",
        status: "POSTED",
      },
    });
    await prisma.journalLine.createMany({
      data: [
        { journalEntryId: je2.id, accountId: accountDebitId, debit: "100", credit: "0" },
        { journalEntryId: je2.id, accountId: accountCreditId, debit: "0", credit: "100" },
      ],
    });

    const result = await prisma.$transaction(async (tx) =>
      repo.sumDebitCredit(tx, orgId, periodAId),
    );

    expect(result.debit).toBeInstanceOf(Prisma.Decimal);
    expect(result.credit).toBeInstanceOf(Prisma.Decimal);
    expect(result.debit.eq(result.credit)).toBe(true);
    expect(result.debit.eq(new Prisma.Decimal("200"))).toBe(true);
  });

  it("sumDebitCredit returns Decimal(0) for period with no POSTED entries", async () => {
    const result = await prisma.$transaction(async (tx) =>
      repo.sumDebitCredit(tx, orgId, periodAId),
    );
    expect(result.debit).toBeInstanceOf(Prisma.Decimal);
    expect(result.credit).toBeInstanceOf(Prisma.Decimal);
    expect(result.debit.eq(new Prisma.Decimal(0))).toBe(true);
    expect(result.credit.eq(new Prisma.Decimal(0))).toBe(true);
  });

  it("sumDebitCredit excludes DRAFT entries from aggregation", async () => {
    const postedJe = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId: periodAId,
        createdById: userId,
        number: 20,
        date: new Date("2026-01-05"),
        description: "Posted JE",
        status: "POSTED",
      },
    });
    await prisma.journalLine.createMany({
      data: [
        { journalEntryId: postedJe.id, accountId: accountDebitId, debit: "50", credit: "0" },
        { journalEntryId: postedJe.id, accountId: accountCreditId, debit: "0", credit: "50" },
      ],
    });

    const draftJe = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId: periodAId,
        createdById: userId,
        number: 21,
        date: new Date("2026-01-06"),
        description: "Draft JE (must not count)",
        status: "DRAFT",
      },
    });
    await prisma.journalLine.createMany({
      data: [
        { journalEntryId: draftJe.id, accountId: accountDebitId, debit: "999", credit: "0" },
        { journalEntryId: draftJe.id, accountId: accountCreditId, debit: "0", credit: "999" },
      ],
    });

    const result = await prisma.$transaction(async (tx) =>
      repo.sumDebitCredit(tx, orgId, periodAId),
    );

    // If DRAFT 999 leaked in, totals would be 1049 not 50
    expect(result.debit.eq(new Prisma.Decimal("50"))).toBe(true);
    expect(result.credit.eq(new Prisma.Decimal("50"))).toBe(true);
  });
});

// ── T14 — lockSales + lockPurchases ──────────────────────────────────────────

describe("MonthlyCloseRepository lock methods — sales + purchases (T14)", () => {
  afterEach(async () => {
    await wipePerTestMutations();
  });

  it("lockSales transitions POSTED sales to LOCKED, returns count", async () => {
    await prisma.sale.createMany({
      data: [
        {
          organizationId: orgId,
          status: "POSTED",
          sequenceNumber: 101,
          date: new Date("2026-01-10"),
          contactId,
          periodId: periodAId,
          description: "Sale 1",
          totalAmount: "100",
          createdById: userId,
        },
        {
          organizationId: orgId,
          status: "POSTED",
          sequenceNumber: 102,
          date: new Date("2026-01-11"),
          contactId,
          periodId: periodAId,
          description: "Sale 2",
          totalAmount: "200",
          createdById: userId,
        },
      ],
    });

    const count = await prisma.$transaction(async (tx) =>
      repo.lockSales(tx, orgId, periodAId),
    );
    expect(count).toBe(2);

    const rows = await prisma.sale.findMany({
      where: { organizationId: orgId, periodId: periodAId },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.status).toBe("LOCKED");
    }
  });

  it("lockPurchases transitions POSTED purchases to LOCKED, returns count", async () => {
    await prisma.purchase.createMany({
      data: [
        {
          organizationId: orgId,
          purchaseType: "COMPRA_GENERAL",
          status: "POSTED",
          sequenceNumber: 201,
          date: new Date("2026-01-12"),
          contactId,
          periodId: periodAId,
          description: "Purchase 1",
          totalAmount: "300",
          createdById: userId,
        },
        {
          organizationId: orgId,
          purchaseType: "COMPRA_GENERAL",
          status: "POSTED",
          sequenceNumber: 202,
          date: new Date("2026-01-13"),
          contactId,
          periodId: periodAId,
          description: "Purchase 2",
          totalAmount: "400",
          createdById: userId,
        },
      ],
    });

    const count = await prisma.$transaction(async (tx) =>
      repo.lockPurchases(tx, orgId, periodAId),
    );
    expect(count).toBe(2);

    const rows = await prisma.purchase.findMany({
      where: { organizationId: orgId, periodId: periodAId },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.status).toBe("LOCKED");
    }
  });

  it("lock methods leave LOCKED documents unchanged", async () => {
    await prisma.sale.create({
      data: {
        organizationId: orgId,
        status: "LOCKED",
        sequenceNumber: 301,
        date: new Date("2026-01-14"),
        contactId,
        periodId: periodAId,
        description: "Already locked sale",
        totalAmount: "500",
        createdById: userId,
      },
    });
    await prisma.purchase.create({
      data: {
        organizationId: orgId,
        purchaseType: "COMPRA_GENERAL",
        status: "LOCKED",
        sequenceNumber: 401,
        date: new Date("2026-01-15"),
        contactId,
        periodId: periodAId,
        description: "Already locked purchase",
        totalAmount: "600",
        createdById: userId,
      },
    });

    const salesCount = await prisma.$transaction(async (tx) =>
      repo.lockSales(tx, orgId, periodAId),
    );
    const purchasesCount = await prisma.$transaction(async (tx) =>
      repo.lockPurchases(tx, orgId, periodAId),
    );

    // Already-LOCKED rows must be excluded from the count
    expect(salesCount).toBe(0);
    expect(purchasesCount).toBe(0);

    // And they remain LOCKED (not corrupted)
    const sales = await prisma.sale.findMany({ where: { organizationId: orgId } });
    const purchases = await prisma.purchase.findMany({ where: { organizationId: orgId } });
    expect(sales[0].status).toBe("LOCKED");
    expect(purchases[0].status).toBe("LOCKED");
  });
});

// ── T16 — markPeriodClosed ────────────────────────────────────────────────────

describe("MonthlyCloseRepository.markPeriodClosed (T16)", () => {
  afterEach(async () => {
    await wipePerTestMutations();
  });

  it("markPeriodClosed sets status=CLOSED, closedAt, closedBy", async () => {
    await prisma.$transaction(async (tx) => {
      await repo.markPeriodClosed(tx, orgId, periodAId, userId);
    });

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodAId },
    });
    expect(period.status).toBe("CLOSED");
    expect(period.closedAt).toBeInstanceOf(Date);
    expect(period.closedAt).not.toBeNull();
    expect(period.closedBy).toBe(userId);
  });
});
