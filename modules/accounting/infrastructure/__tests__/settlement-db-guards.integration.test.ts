import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

/**
 * Postgres-real integration test for the FOUR DB-level settlement guards of
 * migration 20260723120000_settlement_invariant_hardening (W-2 closure,
 * settlement-invariant-hardening final verify).
 *
 * W-2: task 5.1's authorized re-scope replaced permanent expect-rejects tests
 * with a one-time manual protocol — each guard was observed rejecting a real
 * violation ONCE, during the apply. Consequence: a future migration dropping
 * any of the four would leave the entire suite green. This file is the
 * permanent replacement. It asserts BOTH layers, deliberately:
 *  - CATALOGUE — the objects exist in pg_constraint / pg_trigger / pg_proc.
 *    Behaviour alone would not tell you WHICH object vanished.
 *  - BEHAVIOUR — each guard is observed REJECTING a violation on every run.
 *    Existence alone would pass for a constraint whose predicate was
 *    rewritten (e.g. always-true).
 * Positive controls live in their OWN it blocks (overdue-write-surface
 * sentinel pattern) so they cannot mask the rejection assertions: the suite
 * cannot pass by everything being rejected.
 *
 * The four guards (names verified against the migration file):
 *  1. journal_entries_settlement_copopulation_check — CHECK
 *     ("paymentStatus" IS NULL) = ("dueDate" IS NULL)
 *  2. je_settlement_stamp_guard — AFTER UPDATE OF "paymentStatus" trigger
 *     (WHEN NEW."paymentStatus" IS NOT NULL) + je_settlement_stamp_guard_fn:
 *     stamping requires a linked aux row. UPDATE-only by design — fixtures
 *     here (like createLinkedFixture in both settlement integration sisters)
 *     INSERT the JE already stamped, which the trigger deliberately ignores.
 *  3. accounts_receivable_status_no_overdue_check — CHECK status <> 'OVERDUE'
 *  4. accounts_payable_status_no_overdue_check — CHECK status <> 'OVERDUE'
 *
 * Violations run inside prisma.$transaction wrappers that reject and roll
 * back, and every rejection test re-queries the target row to prove nothing
 * leaked. Bootstrap/cleanup mirrors
 * prisma-receivables.repository.integration.test.ts (FK-safe child→parent +
 * audit_logs pass: journal_entries carries an audit trigger).
 *
 * UNMIGRATED DB — declared failure mode: in a database without this
 * migration these tests FAIL (no skip). That is the point of W-2 — silently
 * skipping when the guards are absent would recreate the exact blind spot
 * this file closes. The catalogue tests fail first with a message naming the
 * missing object; the rejection tests fail with "promise resolved" (the
 * violation was accepted).
 *
 * RED-ability — the guards already exist in dev, so the file is born-green.
 * Proven by mutation-check at ship time (each drop in a dedicated tsx round,
 * restored from the migration SQL and re-verified against the catalogue
 * afterwards):
 *  - DROP CONSTRAINT journal_entries_settlement_copopulation_check →
 *    catalogue test REDs naming it + both co-population rejection tests RED
 *    with "promise resolved"; restored.
 *  - DROP TRIGGER je_settlement_stamp_guard + DROP FUNCTION
 *    je_settlement_stamp_guard_fn → both catalogue tests RED (0 rows) + the
 *    stamp rejection test REDs with "promise resolved"; restored.
 *  - DROP CONSTRAINT accounts_receivable_status_no_overdue_check → catalogue
 *    RED + AR UPDATE/INSERT rejection tests RED; restored.
 *  - DROP CONSTRAINT accounts_payable_status_no_overdue_check → catalogue
 *    RED + AP UPDATE/INSERT rejection tests RED; restored.
 */

interface ConstraintRow {
  conname: string;
  relname: string;
  def: string;
}

interface TriggerRow {
  tgname: string;
  tgenabled: string;
  relname: string;
  proname: string;
}

/** pg_constraint lookup, scoped to the owning table. */
async function findCheck(
  table: string,
  conname: string,
): Promise<ConstraintRow[]> {
  return prisma.$queryRaw<ConstraintRow[]>`
    SELECT c.conname, t.relname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ${table} AND c.conname = ${conname}
  `;
}

describe("settlement DB guards — W-2 permanent coverage (catalogue + behaviour)", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let testClienteId: string;
  let testProveedorId: string;
  let jeNumber = 0;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `sdbg-clerk-user-${stamp}`,
        email: `sdbg-${stamp}@test.local`,
        name: "Settlement DB Guards Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `sdbg-clerk-org-${stamp}`,
        name: `Settlement DB Guards Test Org ${stamp}`,
        slug: `sdbg-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "sdbg-integration-period",
        year: 2099,
        month: 6,
        startDate: new Date("2099-06-01T00:00:00Z"),
        endDate: new Date("2099-06-30T23:59:59Z"),
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

    const cliente = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Customer",
        type: "CLIENTE",
        nit: "1234567",
      },
    });
    testClienteId = cliente.id;

    const proveedor = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Supplier",
        type: "PROVEEDOR",
        nit: "7654321",
      },
    });
    testProveedorId = proveedor.id;
  });

  afterEach(async () => {
    // Child→parent: AR/AP reference JE via journalEntryId FK.
    await prisma.accountsReceivable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountsPayable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    // audit_journal_entries trigger fires on create/update/delete.
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    await prisma.accountsReceivable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountsPayable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.voucherTypeCfg.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    // Después de fiscalPeriod.delete — su AFTER DELETE trigger escribe audit.
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  const DUE = new Date("2099-07-15T12:00:00Z");

  /** Stamped JE {PENDING, DUE} — INSERTed pre-stamped (trigger is UPDATE-only). */
  async function createStampedJe(): Promise<{ jeId: string }> {
    jeNumber += 1;
    const je = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        number: jeNumber,
        date: new Date("2099-06-15T12:00:00Z"),
        description: "sdbg fixture journal",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        createdById: testUserId,
        paymentStatus: "PENDING",
        dueDate: DUE,
      },
    });
    return { jeId: je.id };
  }

  /** Stamped JE + linked AR(status=PENDING). */
  async function createLinkedAR(): Promise<{ jeId: string; arId: string }> {
    const { jeId } = await createStampedJe();
    const ar = await prisma.accountsReceivable.create({
      data: {
        organizationId: testOrgId,
        contactId: testClienteId,
        description: "sdbg fixture receivable",
        amount: 100,
        paid: 0,
        balance: 100,
        dueDate: DUE,
        status: "PENDING",
        journalEntryId: jeId,
      },
    });
    return { jeId, arId: ar.id };
  }

  /** Stamped JE + linked AP(status=PENDING). */
  async function createLinkedAP(): Promise<{ jeId: string; apId: string }> {
    const { jeId } = await createStampedJe();
    const ap = await prisma.accountsPayable.create({
      data: {
        organizationId: testOrgId,
        contactId: testProveedorId,
        description: "sdbg fixture payable",
        amount: 100,
        paid: 0,
        balance: 100,
        dueDate: DUE,
        status: "PENDING",
        journalEntryId: jeId,
      },
    });
    return { jeId, apId: ap.id };
  }

  /** Unstamped JE: paymentStatus/dueDate NULL, NO linked aux. */
  async function createUnstampedJe(): Promise<{ jeId: string }> {
    jeNumber += 1;
    const je = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        number: jeNumber,
        date: new Date("2099-06-15T12:00:00Z"),
        description: "sdbg unstamped fixture journal",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        createdById: testUserId,
        // paymentStatus/dueDate intentionally ABSENT → NULL/NULL.
      },
    });
    return { jeId: je.id };
  }

  // ── CATALOGUE — an accidental DROP of any object REDs here by name ────────

  describe("catalogue — the four guard objects exist with their exact shapes", () => {
    it("journal_entries_settlement_copopulation_check exists on journal_entries with the co-population predicate", async () => {
      const rows = await findCheck(
        "journal_entries",
        "journal_entries_settlement_copopulation_check",
      );
      expect(
        rows,
        "MISSING DB GUARD: journal_entries_settlement_copopulation_check (migration 20260723120000 dropped or not applied)",
      ).toHaveLength(1);
      // pg-normalized predicate (pg_get_constraintdef output) — a rewrite of
      // the named constraint to a different predicate must RED here too.
      expect(rows[0].def).toContain(
        `("paymentStatus" IS NULL) = ("dueDate" IS NULL)`,
      );
    });

    it("accounts_receivable_status_no_overdue_check exists on accounts_receivable", async () => {
      const rows = await findCheck(
        "accounts_receivable",
        "accounts_receivable_status_no_overdue_check",
      );
      expect(
        rows,
        "MISSING DB GUARD: accounts_receivable_status_no_overdue_check (migration 20260723120000 dropped or not applied)",
      ).toHaveLength(1);
      expect(rows[0].def).toContain(`status <> 'OVERDUE'::"ReceivableStatus"`);
    });

    it("accounts_payable_status_no_overdue_check exists on accounts_payable", async () => {
      const rows = await findCheck(
        "accounts_payable",
        "accounts_payable_status_no_overdue_check",
      );
      expect(
        rows,
        "MISSING DB GUARD: accounts_payable_status_no_overdue_check (migration 20260723120000 dropped or not applied)",
      ).toHaveLength(1);
      expect(rows[0].def).toContain(`status <> 'OVERDUE'::"PayableStatus"`);
    });

    it("je_settlement_stamp_guard trigger exists on journal_entries, ENABLED, bound to je_settlement_stamp_guard_fn", async () => {
      const rows = await prisma.$queryRaw<TriggerRow[]>`
        SELECT t.tgname, t.tgenabled::text AS tgenabled, c.relname, p.proname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgname = 'je_settlement_stamp_guard'
      `;
      expect(
        rows,
        "MISSING DB GUARD: trigger je_settlement_stamp_guard (migration 20260723120000 dropped or not applied)",
      ).toHaveLength(1);
      expect(rows[0].relname).toBe("journal_entries");
      // 'O' = enabled for origin — an ALTER TABLE … DISABLE TRIGGER REDs here.
      expect(rows[0].tgenabled).toBe("O");
      expect(rows[0].proname).toBe("je_settlement_stamp_guard_fn");
    });

    it("je_settlement_stamp_guard_fn function exists", async () => {
      const rows = await prisma.$queryRaw<Array<{ proname: string }>>`
        SELECT proname FROM pg_proc WHERE proname = 'je_settlement_stamp_guard_fn'
      `;
      expect(
        rows,
        "MISSING DB GUARD: function je_settlement_stamp_guard_fn (migration 20260723120000 dropped or not applied)",
      ).toHaveLength(1);
    });
  });

  // ── BEHAVIOUR — every guard observed REJECTING, rolled back, no leaks ─────

  describe("behaviour — each guard rejects a real violation (rolled back)", () => {
    it("AR CHECK: UPDATE of an existing receivable to OVERDUE is rejected by name; row unchanged", async () => {
      const { arId } = await createLinkedAR();

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE "accounts_receivable" SET "status" = 'OVERDUE' WHERE "id" = ${arId}
          `;
        }),
      ).rejects.toThrow(/accounts_receivable_status_no_overdue_check/);

      const row = await prisma.accountsReceivable.findUnique({
        where: { id: arId },
      });
      expect(row!.status).toBe("PENDING");
    });

    it("AP CHECK: UPDATE of an existing payable to OVERDUE is rejected by name; row unchanged", async () => {
      const { apId } = await createLinkedAP();

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE "accounts_payable" SET "status" = 'OVERDUE' WHERE "id" = ${apId}
          `;
        }),
      ).rejects.toThrow(/accounts_payable_status_no_overdue_check/);

      const row = await prisma.accountsPayable.findUnique({
        where: { id: apId },
      });
      expect(row!.status).toBe("PENDING");
    });

    it("AR CHECK: INSERT of a receivable with status OVERDUE is rejected by name; no row persisted", async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            INSERT INTO "accounts_receivable"
              ("id", "organizationId", "contactId", "description",
               "amount", "balance", "dueDate", "status", "updatedAt")
            VALUES
              (gen_random_uuid()::text, ${testOrgId}, ${testClienteId},
               'sdbg overdue insert attempt', 100, 100, now(), 'OVERDUE', now())
          `;
        }),
      ).rejects.toThrow(/accounts_receivable_status_no_overdue_check/);

      const leaked = await prisma.accountsReceivable.count({
        where: { organizationId: testOrgId },
      });
      expect(leaked).toBe(0);
    });

    it("AP CHECK: INSERT of a payable with status OVERDUE is rejected by name; no row persisted", async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            INSERT INTO "accounts_payable"
              ("id", "organizationId", "contactId", "description",
               "amount", "balance", "dueDate", "status", "updatedAt")
            VALUES
              (gen_random_uuid()::text, ${testOrgId}, ${testProveedorId},
               'sdbg overdue insert attempt', 100, 100, now(), 'OVERDUE', now())
          `;
        }),
      ).rejects.toThrow(/accounts_payable_status_no_overdue_check/);

      const leaked = await prisma.accountsPayable.count({
        where: { organizationId: testOrgId },
      });
      expect(leaked).toBe(0);
    });

    it("co-population CHECK: dueDate stamped while paymentStatus stays NULL is rejected by name; JE stays NULL/NULL", async () => {
      const { jeId } = await createUnstampedJe();

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE "journal_entries" SET "dueDate" = now() WHERE "id" = ${jeId}
          `;
        }),
      ).rejects.toThrow(/journal_entries_settlement_copopulation_check/);

      const row = await prisma.journalEntry.findUnique({ where: { id: jeId } });
      expect(row!.paymentStatus).toBeNull();
      expect(row!.dueDate).toBeNull();
    });

    it("co-population CHECK (inverse): paymentStatus NULLed while dueDate stays is rejected by name; JE unchanged", async () => {
      // Linked stamped fixture: the trigger's WHEN clause
      // (NEW."paymentStatus" IS NOT NULL) is false here, so the ONLY guard
      // that can reject this UPDATE is the co-population CHECK — asserted by
      // constraint name below.
      const { jeId } = await createLinkedAR();

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE "journal_entries" SET "paymentStatus" = NULL WHERE "id" = ${jeId}
          `;
        }),
      ).rejects.toThrow(/journal_entries_settlement_copopulation_check/);

      const row = await prisma.journalEntry.findUnique({ where: { id: jeId } });
      expect(row!.paymentStatus).toBe("PENDING");
      expect(row!.dueDate).toEqual(DUE);
    });

    it("stamp trigger: stamping a JE with NO linked aux row is rejected by the trigger message; JE stays NULL/NULL", async () => {
      const { jeId } = await createUnstampedJe();

      // Both columns set so the co-population CHECK is satisfied — the
      // rejection asserted below can only come from the trigger (its RAISE
      // EXCEPTION text, not a constraint-violation message).
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE "journal_entries"
            SET "paymentStatus" = 'PENDING', "dueDate" = now()
            WHERE "id" = ${jeId}
          `;
        }),
      ).rejects.toThrow(/stamped without linked aux/);

      const row = await prisma.journalEntry.findUnique({ where: { id: jeId } });
      expect(row!.paymentStatus).toBeNull();
      expect(row!.dueDate).toBeNull();
    });
  });

  // ── POSITIVE CONTROLS — own it blocks so they cannot mask rejections ──────

  describe("positive controls (born-green) — legitimate operations still succeed", () => {
    it("stamp UPDATE on a JE with a linked receivable passes the trigger — PENDING → PAID lands", async () => {
      const { jeId } = await createLinkedAR();

      await prisma.journalEntry.update({
        where: { id: jeId },
        data: { paymentStatus: "PAID" },
      });

      const row = await prisma.journalEntry.findUnique({ where: { id: jeId } });
      expect(row!.paymentStatus).toBe("PAID");
      expect(row!.dueDate).toEqual(DUE);
    });

    it("both-NULL unstamp passes the co-population CHECK (trigger WHEN clause not met)", async () => {
      const { jeId } = await createLinkedAR();

      await prisma.journalEntry.update({
        where: { id: jeId },
        data: { paymentStatus: null, dueDate: null },
      });

      const row = await prisma.journalEntry.findUnique({ where: { id: jeId } });
      expect(row!.paymentStatus).toBeNull();
      expect(row!.dueDate).toBeNull();
    });

    it("aux transition to PAID still lands in both sisters (CHECKs only close OVERDUE)", async () => {
      const { arId } = await createLinkedAR();
      const { apId } = await createLinkedAP();

      await prisma.accountsReceivable.update({
        where: { id: arId },
        data: { status: "PAID" },
      });
      await prisma.accountsPayable.update({
        where: { id: apId },
        data: { status: "PAID" },
      });

      const arRow = await prisma.accountsReceivable.findUnique({
        where: { id: arId },
      });
      const apRow = await prisma.accountsPayable.findUnique({
        where: { id: apId },
      });
      expect(arRow!.status).toBe("PAID");
      expect(apRow!.status).toBe("PAID");
    });
  });
});
