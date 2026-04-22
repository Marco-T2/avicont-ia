/**
 * Phase 3 — MonthlyCloseRepository integration tests (cierre-periodo).
 *
 * Exercises the real Postgres test DB (no mocks). Fixture state is shared
 * across describe blocks via a top-level beforeAll/afterAll pair; each `it`
 * seeds its own row subset as needed and cleans up mutations after.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { MonthlyCloseRepository } from "../monthly-close.repository";

const repo = new MonthlyCloseRepository();

// ── Shared fixture state ──────────────────────────────────────────────────────

let orgId: string;
let userId: string;
let periodAId: string; // primary period under test
let periodBId: string; // isolation target
let voucherTypeId: string;
let contactId: string;

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
});

afterAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } });
  await prisma.dispatch.deleteMany({ where: { organizationId: orgId } });
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.sale.deleteMany({ where: { organizationId: orgId } });
  await prisma.purchase.deleteMany({ where: { organizationId: orgId } });
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
