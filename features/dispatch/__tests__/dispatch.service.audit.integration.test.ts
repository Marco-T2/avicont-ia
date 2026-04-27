/**
 * B1 — dispatch.post() real-DB audit integration test.
 *
 * Verifies that when dispatch.post() is called, the Postgres audit trigger
 * emits audit_logs rows with non-null changedById for all mutated entity types
 * (dispatches, journal_entries, journal_lines).
 *
 * TDD note: Phase 1 GREEN code (setAuditContext wiring) already exists; unit
 * tests in dispatch.service.audit.test.ts proved RED→GREEN at site granularity.
 * This integration test is a post-hoc smoke test confirming that the wiring +
 * Postgres trigger interaction holds end-to-end. Accepted as "validate, not
 * re-prove" per project convention.
 *
 * @vitest-environment node
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { setAuditContext } from "@/features/shared/audit-context";

// ── IDs captured in beforeAll for use in the single test + afterAll ──────────

let orgId: string;
let userId: string;
let periodId: string;
let contactId: string;
let draftDispatchId: string;

// ── Fixture setup ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  const stamp = Date.now();

  // 1. User
  const user = await prisma.user.create({
    data: {
      clerkUserId: `dispatch-audit-int-${stamp}`,
      email: `dispatch-audit-int-${stamp}@test.com`,
      name: "Dispatch Audit Integration",
    },
  });
  userId = user.id;

  // 2. Organization
  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `clerk-disp-audit-${stamp}`,
      slug: `disp-audit-${stamp}`,
      name: "Dispatch Audit Integration Org",
    },
  });
  orgId = org.id;

  // 3. Fiscal period (OPEN)
  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `Dispatch audit period ${stamp}`,
      year: 2026,
      month: 4,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodId = period.id;

  // 4. OrgSettings — cxcAccountCode must match an account we create below.
  //    We pick code "1.1.4.1" (the schema default) so getOrCreate returns it
  //    without us having to patch anything.
  await prisma.orgSettings.create({
    data: {
      organizationId: orgId,
      cxcAccountCode: "1.1.4.1",
    },
  });

  // 5. Chart of accounts — minimum two leaf accounts required by post():
  //    a. CxC account (code from orgSettings.cxcAccountCode → "1.1.4.1")
  //    b. Income account (dispatch.post uses "4.1.2" for NOTA_DESPACHO)
  await prisma.account.createMany({
    data: [
      {
        organizationId: orgId,
        code: "1.1.4.1",
        name: "Cuentas por Cobrar Int",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 4,
        isDetail: true,
      },
      {
        organizationId: orgId,
        code: "4.1.2",
        name: "Ingresos Despacho Int",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 3,
        isDetail: true,
      },
    ],
  });

  // 6. VoucherTypeCfg with code "CD" (required by autoEntryGenerator.generate)
  await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: "CD",
      prefix: "D",
      name: "Comprobante Despacho Int",
    },
  });

  // 7. Contact (CLIENTE) with paymentTermsDays
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      type: "CLIENTE",
      name: "Cliente Despacho Int",
      paymentTermsDays: 30,
    },
  });
  contactId = contact.id;

  // 8. Draft dispatch with one detail — use prisma directly so we bypass
  //    DispatchService.create (which requires shrinkage/boxes computation).
  //    sequenceNumber = 0 is the convention for unposted drafts (see cloneToDraft).
  const dispatch = await prisma.dispatch.create({
    data: {
      organizationId: orgId,
      dispatchType: "NOTA_DESPACHO",
      status: "DRAFT",
      sequenceNumber: 0,
      date: new Date("2026-04-15T12:00:00Z"),
      contactId,
      periodId,
      description: "Despacho int test",
      createdById: userId,
      details: {
        create: [
          {
            description: "Pollo int",
            boxes: 5,
            grossWeight: "50.0000",
            tare: "10.0000",
            netWeight: "40.0000",
            unitPrice: "10.0000",
            lineAmount: "400.00",
            order: 0,
          },
        ],
      },
    },
  });
  draftDispatchId = dispatch.id;
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Deletes inside a tx with audit context to satisfy the trigger requirement
  // (the trigger fires AFTER DELETE on journal_lines and dispatches).
  await prisma.$transaction(async (tx) => {
    await setAuditContext(tx, userId, orgId);
    await tx.accountBalance.deleteMany({ where: { organizationId: orgId } });
    await tx.journalLine.deleteMany({
      where: { journalEntry: { organizationId: orgId } },
    });
    await tx.journalEntry.deleteMany({ where: { organizationId: orgId } });
    await tx.accountsReceivable.deleteMany({ where: { organizationId: orgId } });
    await tx.dispatch.deleteMany({ where: { organizationId: orgId } });
    await tx.account.deleteMany({ where: { organizationId: orgId } });
    await tx.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
    await tx.contact.deleteMany({ where: { organizationId: orgId } });
    await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    await tx.orgSettings.deleteMany({ where: { organizationId: orgId } });
    await tx.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

// ── The single integration test ───────────────────────────────────────────────

describe("DispatchService.post() — Phase 1 audit integration (real DB)", () => {
  it("post() emits audit_logs rows with non-null changedById on dispatches + journal_entries + journal_lines", async () => {
    // Clear any audit_logs already in the org (from beforeAll setup) so we
    // can assert solely on what post() emits, without a timing-based filter.
    // The delete itself runs inside a tx with audit context to satisfy the
    // trigger requirement on audit_logs (no audit trigger on audit_logs itself,
    // but setAuditContext is idiomatic for any tx touching audited tables).
    await prisma.$transaction(async (tx) => {
      await setAuditContext(tx, userId, orgId);
      await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    });

    const service = new DispatchService();
    await service.post(orgId, draftDispatchId, userId);

    // Query ALL audit rows for the org — everything here was emitted by post()
    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: { in: ["dispatches", "journal_entries", "journal_lines"] },
      },
    });

    // Sanity: at minimum the dispatch STATUS_CHANGE + JE CREATE + JL CREATE rows
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.changedById, `changedById null on ${row.entityType}:${row.entityId}`).not.toBeNull();
      expect(row.changedById).toBe(userId);
    }

    // Report entity type breakdown (informational — helps debugging failures)
    const byType = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.entityType] = (acc[r.entityType] ?? 0) + 1;
      return acc;
    }, {});

    // Expect at least one row per key entity type
    expect(Object.keys(byType)).toContain("dispatches");
    expect(Object.keys(byType)).toContain("journal_entries");
    expect(Object.keys(byType)).toContain("journal_lines");

    // Log breakdown for the test report
    console.log("Audit rows by entity type:", byType);
  });
});
