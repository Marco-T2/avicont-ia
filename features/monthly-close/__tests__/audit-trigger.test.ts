/**
 * T03 + T05 — Audit trigger tests for cierre-periodo (RED).
 *
 * Asserts:
 *   T03: audit_trigger_fn() reads `app.correlation_id` session var and persists it
 *        into audit_logs.correlationId.
 *   T05(a): audit_fiscal_periods trigger fires on fiscal_periods UPDATE (STATUS_CHANGE).
 *   T05(b): audit_purchases trigger fires on purchases UPDATE.
 *
 * Integration test — exercises real triggers against the live test DB.
 * Cleanup: each test seeds a fresh org and targeted rows, then removes them.
 *
 * Covers: REQ-8 (correlationId propagation), audit-log spec §triggers.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

let orgId: string;
let userId: string;
let periodId: string;
let contactId: string;
let purchaseId: string;

beforeEach(async () => {
  const now = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-audit-trigger-${now}`,
      email: `audit-trigger-${now}@test.com`,
      name: "Audit Trigger Test",
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `clerk-audit-trigger-${now}`,
      slug: `audit-trigger-${now}`,
      name: "Audit Trigger Org",
    },
  });
  orgId = org.id;

  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `Audit trigger period ${now}`,
      year: 2026,
      month: 1,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodId = period.id;

  await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: "CP",
      prefix: "CP",
      name: "Comprobante Pago",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      type: "PROVEEDOR",
      name: "Proveedor Test",
    },
  });
  contactId = contact.id;

  const purchase = await prisma.purchase.create({
    data: {
      organizationId: orgId,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 1,
      date: new Date("2026-01-15"),
      contactId,
      periodId,
      description: "Purchase for trigger test",
      totalAmount: "100.00",
      createdById: userId,
    },
  });
  purchaseId = purchase.id;
});

afterEach(async () => {
  // Remove audit rows first (no FK) to keep the test DB tidy.
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.purchase.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("Audit triggers — cierre-periodo", () => {
  it("trigger reads app.correlation_id session var and persists it (T03)", async () => {
    const expected = `test-corr-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        userId,
      );
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.correlation_id', $1, true)`,
        expected,
      );
      await tx.$executeRawUnsafe(
        `UPDATE purchases SET status = 'LOCKED' WHERE id = $1`,
        purchaseId,
      );
    });

    // Filtramos por action='STATUS_CHANGE' (UPDATE puntual con cambio de
    // status). Post-ADR-002 el trigger también emite una row CREATE en el
    // INSERT del beforeEach (sin correlationId) — la excluimos del assert.
    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "purchases",
        entityId: purchaseId,
        action: "STATUS_CHANGE",
      },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.correlationId).toBe(expected);
    }
  });

  it("correlationId is null when app.correlation_id is not set (fail-safe)", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        userId,
      );
      // NB: no set_config for app.correlation_id
      await tx.$executeRawUnsafe(
        `UPDATE purchases SET status = 'LOCKED' WHERE id = $1`,
        purchaseId,
      );
    });

    const rows = await prisma.auditLog.findMany({
      where: { organizationId: orgId, entityType: "purchases", entityId: purchaseId },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.correlationId).toBeNull();
    }
  });

  it("audit_fiscal_periods fires on period UPDATE (T05a)", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        userId,
      );
      await tx.$executeRawUnsafe(
        `UPDATE fiscal_periods SET status = 'CLOSED' WHERE id = $1`,
        periodId,
      );
    });

    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("STATUS_CHANGE");
  });

  it("audit_purchases fires on purchase UPDATE (T05b)", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        userId,
      );
      await tx.$executeRawUnsafe(
        `UPDATE purchases SET description = 'updated desc' WHERE id = $1`,
        purchaseId,
      );
    });

    // Filtramos por action='UPDATE' porque post-ADR-002 el trigger también
    // emite una row CREATE en el INSERT del beforeEach. Este test apunta
    // específicamente al UPDATE.
    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "purchases",
        entityId: purchaseId,
        action: "UPDATE",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("purchases");
  });
});
