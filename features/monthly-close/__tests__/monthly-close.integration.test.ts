/**
 * Phase 5 — MonthlyCloseService.close integration tests (cierre-periodo).
 *
 * Exercises real Postgres test DB: real period + balanced POSTED docs in
 * all 5 entities; service.close() must close the period, LOCK all docs,
 * and emit audit_logs rows that share one correlationId (REQ-5, REQ-8, REQ-A1).
 *
 * Covers:
 *   T30 — happy-path observable contract.
 *   T31 — atomic rollback when a lock step mid-TX throws.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { MonthlyCloseRepository } from "../monthly-close.repository";
import { MonthlyCloseService } from "../monthly-close.service";
import { FiscalPeriodsService } from "@/features/fiscal-periods/fiscal-periods.service";

let orgId: string;
let userId: string;
let periodId: string;
let voucherTypeId: string;
let contactId: string;
let accountDebitId: string;
let accountCreditId: string;

beforeEach(async () => {
  const now = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-mc-int-${now}`,
      email: `mc-int-${now}@test.com`,
      name: "MC Integration Test",
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `clerk-mc-int-${now}`,
      slug: `mc-int-${now}`,
      name: "MC Integration Org",
    },
  });
  orgId = org.id;

  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `MC integration period ${now}`,
      year: 2026,
      month: 3,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodId = period.id;

  const vt = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-INT-${now}`,
      prefix: "CI",
      name: "Comprobante Ingreso Int",
    },
  });
  voucherTypeId = vt.id;

  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      type: "CLIENTE",
      name: "Cliente Test Int",
    },
  });
  contactId = contact.id;

  const accountDebit = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.1.1-INT-${now}`,
      name: "Cuenta Deudora Int",
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
      code: `3.1.1-INT-${now}`,
      name: "Cuenta Acreedora Int",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
    },
  });
  accountCreditId = accountCredit.id;
});

afterEach(async () => {
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

async function seedBalancedPostedDocs() {
  // 1 POSTED Dispatch
  await prisma.dispatch.create({
    data: {
      organizationId: orgId,
      dispatchType: "NOTA_DESPACHO",
      status: "POSTED",
      sequenceNumber: 1001,
      date: new Date("2026-03-10"),
      contactId,
      periodId,
      description: "Posted dispatch",
      totalAmount: "100.00",
      createdById: userId,
    },
  });

  // 1 POSTED Payment
  await prisma.payment.create({
    data: {
      organizationId: orgId,
      status: "POSTED",
      method: "EFECTIVO",
      date: new Date("2026-03-11"),
      amount: "50.00",
      description: "Posted payment",
      periodId,
      contactId,
      createdById: userId,
    },
  });

  // 1 POSTED JournalEntry with balanced journal_lines (DEBE = HABER)
  const je = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId,
      periodId,
      createdById: userId,
      number: 10,
      date: new Date("2026-03-12"),
      description: "Balanced JE for integration",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: je.id, accountId: accountDebitId, debit: "100", credit: "0" },
      { journalEntryId: je.id, accountId: accountCreditId, debit: "0", credit: "100" },
    ],
  });

  // 1 POSTED Sale
  await prisma.sale.create({
    data: {
      organizationId: orgId,
      status: "POSTED",
      sequenceNumber: 2001,
      date: new Date("2026-03-13"),
      contactId,
      periodId,
      description: "Posted sale",
      totalAmount: "300",
      createdById: userId,
    },
  });

  // 1 POSTED Purchase
  await prisma.purchase.create({
    data: {
      organizationId: orgId,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 3001,
      date: new Date("2026-03-14"),
      contactId,
      periodId,
      description: "Posted purchase",
      totalAmount: "400",
      createdById: userId,
    },
  });
}

// ── T30 — Observable contract (happy path) ──────────────────────────────────

describe("MonthlyCloseService.close — integration happy path (T30)", () => {
  it("close produces observable contract: period CLOSED, all POSTED docs LOCKED, audit rows share correlationId", async () => {
    await seedBalancedPostedDocs();

    const service = new MonthlyCloseService(
      new MonthlyCloseRepository(),
      new FiscalPeriodsService(),
    );

    const result = await service.close({
      organizationId: orgId,
      periodId,
      userId,
    });

    // Result shape.
    expect(result.periodStatus).toBe("CLOSED");
    expect(result.closedAt).toBeInstanceOf(Date);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.locked.dispatches).toBe(1);
    expect(result.locked.payments).toBe(1);
    expect(result.locked.journalEntries).toBe(1);
    expect(result.locked.sales).toBe(1);
    expect(result.locked.purchases).toBe(1);

    // DB state: period is CLOSED with closedBy/closedAt.
    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("CLOSED");
    expect(period.closedAt).toBeInstanceOf(Date);
    expect(period.closedBy).toBe(userId);

    // DB state: every seeded doc is LOCKED.
    const [dispatches, payments, journalEntries, sales, purchases] =
      await Promise.all([
        prisma.dispatch.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.payment.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.journalEntry.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.sale.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.purchase.findMany({ where: { organizationId: orgId, periodId } }),
      ]);

    for (const row of [
      ...dispatches,
      ...payments,
      ...journalEntries,
      ...sales,
      ...purchases,
    ]) {
      expect(row.status).toBe("LOCKED");
    }

    // Audit rows share the same correlationId across all 6 entity types.
    const auditRows = await prisma.auditLog.findMany({
      where: { organizationId: orgId, correlationId: result.correlationId },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    for (const row of auditRows) {
      expect(row.correlationId).toBe(result.correlationId);
    }

    const entityTypes = new Set(auditRows.map((r) => r.entityType));
    expect(entityTypes.has("dispatches")).toBe(true);
    expect(entityTypes.has("payments")).toBe(true);
    expect(entityTypes.has("journal_entries")).toBe(true);
    expect(entityTypes.has("sales")).toBe(true);
    expect(entityTypes.has("purchases")).toBe(true);
    expect(entityTypes.has("fiscal_periods")).toBe(true);
  });
});

// ── T31 — Atomic rollback on lock failure ───────────────────────────────────

describe("MonthlyCloseService.close — integration rollback (T31)", () => {
  it("close rolls back entirely if lockJournalEntries throws", async () => {
    await seedBalancedPostedDocs();

    // Build a repo whose lockJournalEntries throws mid-transaction — after
    // lockDispatches and lockPayments succeed. We pass a SUBCLASSED repo to
    // the service constructor so the service uses our instance directly
    // (avoids the fragility of vi.spyOn against a nested `new`).
    class FailingRepo extends MonthlyCloseRepository {
      override async lockJournalEntries(): Promise<number> {
        throw new Error("simulated mid-cascade failure");
      }
    }

    const service = new MonthlyCloseService(
      new FailingRepo(),
      new FiscalPeriodsService(),
    );

    await expect(
      service.close({ organizationId: orgId, periodId, userId }),
    ).rejects.toThrow(/simulated mid-cascade failure/);

    // Period untouched.
    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    // All docs still POSTED — no partial LOCK.
    const [dispatches, payments, journalEntries, sales, purchases] =
      await Promise.all([
        prisma.dispatch.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.payment.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.journalEntry.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.sale.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.purchase.findMany({ where: { organizationId: orgId, periodId } }),
      ]);

    for (const row of [
      ...dispatches,
      ...payments,
      ...journalEntries,
      ...sales,
      ...purchases,
    ]) {
      expect(row.status).toBe("POSTED");
    }
  });
});

// ── User-Phase 3 — DRAFT-blocks-close side-effect tests (T13-T17) ────────────
//
// For each of the 5 entities, seed one DRAFT row (only that entity), call
// close(), and assert the service REJECTS; then verify three invariants:
//   (a) period.status remains OPEN (+ closedAt/closedBy null),
//   (b) the DRAFT row is still DRAFT (no mutation),
//   (c) no STATUS_CHANGE audit row was emitted for fiscal_periods on this period.
//
// T16 (Sale) and T17 (Purchase) are the F-03 resolution tests — before T21
// they fail because Sale/Purchase DRAFT rows leak through the 3-key
// countDraftDocuments → close() proceeds to the TX path and the period ends
// up CLOSED (silent corruption). Any such failure still proves the invariant
// is broken.

describe("MonthlyCloseService.close — DRAFT blocks close (T13-T17)", () => {
  it("Dispatch DRAFT blocks close — period.status and DRAFT row unchanged, no AuditLog emitted", async () => {
    const draft = await prisma.dispatch.create({
      data: {
        organizationId: orgId,
        dispatchType: "NOTA_DESPACHO",
        status: "DRAFT",
        sequenceNumber: 9001,
        date: new Date("2026-03-05"),
        contactId,
        periodId,
        description: "Draft dispatch blocks close",
        totalAmount: "100.00",
        createdById: userId,
      },
    });

    const service = new MonthlyCloseService(
      new MonthlyCloseRepository(),
      new FiscalPeriodsService(),
    );

    await expect(
      service.close({ organizationId: orgId, periodId, userId }),
    ).rejects.toThrow();

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.dispatch.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });

  it("Payment DRAFT blocks close — period.status and DRAFT row unchanged, no AuditLog emitted", async () => {
    const draft = await prisma.payment.create({
      data: {
        organizationId: orgId,
        status: "DRAFT",
        method: "EFECTIVO",
        date: new Date("2026-03-06"),
        amount: "75.00",
        description: "Draft payment blocks close",
        periodId,
        contactId,
        createdById: userId,
      },
    });

    const service = new MonthlyCloseService(
      new MonthlyCloseRepository(),
      new FiscalPeriodsService(),
    );

    await expect(
      service.close({ organizationId: orgId, periodId, userId }),
    ).rejects.toThrow();

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.payment.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });

  it("JournalEntry DRAFT blocks close — period.status and DRAFT row unchanged, no AuditLog emitted", async () => {
    const draft = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId,
        createdById: userId,
        number: 42,
        date: new Date("2026-03-07"),
        description: "Draft JE blocks close",
        status: "DRAFT",
      },
    });

    const service = new MonthlyCloseService(
      new MonthlyCloseRepository(),
      new FiscalPeriodsService(),
    );

    await expect(
      service.close({ organizationId: orgId, periodId, userId }),
    ).rejects.toThrow();

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });
});
