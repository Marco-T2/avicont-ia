/**
 * T3 — RED: Integration tests for WorksheetRepository against a real Prisma test DB.
 *
 * Strategy: each describe block builds a fixture in beforeAll, tears it down in afterAll.
 * Follows the pattern from iva-books.repository.test.ts — real $queryRaw, no mocks.
 *
 * Covers REQ-1 (dual isAdjustment aggregation), NFR-3 (multi-tenant isolation).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { WorksheetRepository } from "../worksheet.repository";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

// ── Shared fixture state ──────────────────────────────────────────────────────

let orgId: string;
let orgBId: string; // second org for isolation tests
let userId: string;
let fiscalPeriodId: string;

// Voucher type IDs
let ciVoucherTypeId: string; // isAdjustment = false
let cjVoucherTypeId: string; // isAdjustment = true

// Account IDs
let cajaAccountId: string; // 1.1.1 Caja — ACTIVO
let capitalAccountId: string; // 3.1.1 Capital — PATRIMONIO
let orgBCajaAccountId: string; // account in org B

beforeAll(async () => {
  const now = Date.now();

  // User
  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-worksheet-repo-${now}`,
      email: `worksheet-repo-${now}@test.com`,
      name: "Worksheet Repo Test",
    },
  });
  userId = user.id;

  // Org A
  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-worksheet-${now}`,
      name: "Test Org Worksheet",
      slug: `test-org-worksheet-${now}`,
    },
  });
  orgId = org.id;

  // Org B (for multi-tenant isolation tests)
  const orgB = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-worksheet-b-${now}`,
      name: "Test Org B Worksheet",
      slug: `test-org-worksheet-b-${now}`,
    },
  });
  orgBId = orgB.id;

  // Fiscal period
  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: "Gestión 2025",
      year: 2025,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });
  fiscalPeriodId = period.id;

  // Voucher type CI — isAdjustment = false (Comprobante de Ingreso)
  const ciVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-WS-${now}`,
      prefix: "CI",
      name: "Comprobante de Ingreso",
      isAdjustment: false,
    },
  });
  ciVoucherTypeId = ciVoucher.id;

  // Voucher type CJ — isAdjustment = true (Comprobante de Ajuste)
  const cjVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CJ-WS-${now}`,
      prefix: "CJ",
      name: "Comprobante de Ajuste",
      isAdjustment: true,
    },
  });
  cjVoucherTypeId = cjVoucher.id;

  // Voucher type CE for Org B (isolation)
  const ceBVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgBId,
      code: `CE-WS-B-${now}`,
      prefix: "CE",
      name: "Comprobante de Egreso B",
      isAdjustment: false,
    },
  });

  // Accounts in Org A
  const cajaAccount = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.1.1-WS-${now}`,
      name: "Caja",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  cajaAccountId = cajaAccount.id;

  const capitalAccount = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `3.1.1-WS-${now}`,
      name: "Capital Social",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  capitalAccountId = capitalAccount.id;

  // Account in Org B
  const orgBCajaAccount = await prisma.account.create({
    data: {
      organizationId: orgBId,
      code: `1.1.1-WS-B-${now}`,
      name: "Caja B",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  orgBCajaAccountId = orgBCajaAccount.id;

  // ── Journal entries in Org A ───────────────────────────────────────────────

  // CI entry: POSTED, isAdjustment=false — contributes to Sumas
  const ciEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      periodId: fiscalPeriodId,
      voucherTypeId: ciVoucherTypeId,
      number: 1,
      date: new Date("2025-06-15"),
      description: "CI Test Entry",
      status: "POSTED",
      createdById: userId,
    },
  });
  // CI line: Caja Debe=207000, Capital Haber=207000
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: ciEntry.id, accountId: cajaAccountId, debit: D("207000"), credit: D("0") },
      { journalEntryId: ciEntry.id, accountId: capitalAccountId, debit: D("0"), credit: D("207000") },
    ],
  });

  // CE entry (isAdjustment=false): Caja Haber=23152
  const cjEntry1 = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      periodId: fiscalPeriodId,
      voucherTypeId: ciVoucherTypeId,
      number: 2,
      date: new Date("2025-07-20"),
      description: "CE Test Entry",
      status: "POSTED",
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cjEntry1.id, accountId: cajaAccountId, debit: D("0"), credit: D("23152") },
      { journalEntryId: cjEntry1.id, accountId: capitalAccountId, debit: D("23152"), credit: D("0") },
    ],
  });

  // CJ entry: POSTED, isAdjustment=true — contributes to Ajustes
  const cjEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      periodId: fiscalPeriodId,
      voucherTypeId: cjVoucherTypeId,
      number: 1,
      date: new Date("2025-12-31"),
      description: "CJ Adjustment Entry",
      status: "POSTED",
      createdById: userId,
    },
  });
  // CJ line: Caja AjDebe=5000
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cjEntry.id, accountId: cajaAccountId, debit: D("5000"), credit: D("0") },
      { journalEntryId: cjEntry.id, accountId: capitalAccountId, debit: D("0"), credit: D("5000") },
    ],
  });

  // DRAFT entry — must NOT appear in aggregations (only POSTED counts)
  const draftEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      periodId: fiscalPeriodId,
      voucherTypeId: ciVoucherTypeId,
      number: 3,
      date: new Date("2025-08-01"),
      description: "Draft — ignored",
      status: "DRAFT",
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: draftEntry.id, accountId: cajaAccountId, debit: D("999999"), credit: D("0") },
    ],
  });

  // ── Journal entry in Org B ─────────────────────────────────────────────────
  const periodB = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgBId,
      name: "Gestión 2025 B",
      year: 2025,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });

  const entryB = await prisma.journalEntry.create({
    data: {
      organizationId: orgBId,
      periodId: periodB.id,
      voucherTypeId: ceBVoucher.id,
      number: 1,
      date: new Date("2025-06-15"),
      description: "Org B entry — must not appear in org A query",
      status: "POSTED",
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      {
        journalEntryId: entryB.id,
        accountId: orgBCajaAccountId,
        debit: D("888888"),
        credit: D("0"),
      },
    ],
  });
});

afterAll(async () => {
  // Delete in dependency order
  // 1. Journal lines (via cascade from journal entries)
  // 2. Journal entries
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } });
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgBId } });
  // 3. Accounts
  await prisma.account.deleteMany({ where: { organizationId: orgId } });
  await prisma.account.deleteMany({ where: { organizationId: orgBId } });
  // 4. VoucherTypeCfg
  await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
  await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: orgBId } });
  // 5. FiscalPeriod
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgBId } });
  // 6. AuditLog — must delete before org due to RESTRICT FK
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgBId } });
  // 7. Orgs
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.organization.delete({ where: { id: orgBId } });
  // 8. User
  await prisma.user.delete({ where: { id: userId } });

  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorksheetRepository", () => {
  let repo: WorksheetRepository;

  beforeAll(() => {
    repo = new WorksheetRepository();
  });

  const range = {
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
  };

  // ── aggregateByAdjustmentFlag (isAdjustment=false) — Sumas ──────────────────

  describe("aggregateByAdjustmentFlag — isAdjustment=false (Sumas)", () => {
    it("returns only entries from non-adjustment vouchers", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        false,
      );

      // Caja: CI Debe=207000, CE Haber=23152 (both isAdjustment=false)
      const caja = results.find((r) => r.accountId === cajaAccountId);
      expect(caja).toBeDefined();
      expect(caja!.totalDebit.toFixed(2)).toBe("207000.00");
      expect(caja!.totalCredit.toFixed(2)).toBe("23152.00");
    });

    it("does NOT include CJ (isAdjustment=true) entries in Sumas", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        false,
      );

      // CJ posted Debe=5000 to Caja — must NOT be in the non-adjustment agg
      // If it leaked in, totalDebit would be 212000
      const caja = results.find((r) => r.accountId === cajaAccountId);
      expect(caja).toBeDefined();
      // totalDebit should be only 207000 (CI), not 212000 (CI + CJ)
      expect(new Prisma.Decimal(caja!.totalDebit).toFixed(2)).toBe("207000.00");
    });

    it("does NOT include DRAFT entries", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        false,
      );
      const caja = results.find((r) => r.accountId === cajaAccountId);
      // Draft entry has Debe=999999; if it leaked totalDebit would be 1206999
      expect(new Prisma.Decimal(caja!.totalDebit).toFixed(2)).toBe("207000.00");
    });

    it("returns MovementAggregation with Decimal totalDebit and totalCredit", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        false,
      );
      const caja = results.find((r) => r.accountId === cajaAccountId);
      expect(caja!.totalDebit).toBeInstanceOf(Prisma.Decimal);
      expect(caja!.totalCredit).toBeInstanceOf(Prisma.Decimal);
    });
  });

  // ── aggregateByAdjustmentFlag (isAdjustment=true) — Ajustes ────────────────

  describe("aggregateByAdjustmentFlag — isAdjustment=true (Ajustes)", () => {
    it("returns only entries from adjustment vouchers (CJ)", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        true,
      );

      // Only CJ entry: Caja AjDebe=5000
      const caja = results.find((r) => r.accountId === cajaAccountId);
      expect(caja).toBeDefined();
      expect(caja!.totalDebit.toFixed(2)).toBe("5000.00");
      expect(caja!.totalCredit.toFixed(2)).toBe("0.00");
    });

    it("does NOT include non-adjustment (CI/CE) entries in Ajustes", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        true,
      );

      // CI had Debe=207000 — must not leak into CJ aggregation
      const caja = results.find((r) => r.accountId === cajaAccountId);
      expect(caja).toBeDefined();
      expect(new Prisma.Decimal(caja!.totalDebit).toFixed(2)).toBe("5000.00");
    });

    it("returns empty array if no CJ entries exist for the period", async () => {
      // Query outside the fixture date range
      const emptyRange = {
        dateFrom: new Date("2020-01-01"),
        dateTo: new Date("2020-12-31"),
      };
      const results = await repo.aggregateByAdjustmentFlag(orgId, emptyRange, true);
      expect(results).toHaveLength(0);
    });
  });

  // ── Multi-tenant isolation ──────────────────────────────────────────────────

  describe("multi-tenant isolation (NFR-3)", () => {
    it("org A query does not return org B entries", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgId,
        range,
        false,
      );

      // orgBCajaAccountId had Debe=888888 — must NOT appear
      const orgBEntry = results.find((r) => r.accountId === orgBCajaAccountId);
      expect(orgBEntry).toBeUndefined();
    });

    it("org B query does not return org A entries", async () => {
      const results = await repo.aggregateByAdjustmentFlag(
        orgBId,
        range,
        false,
      );

      // cajaAccountId (org A) had Debe=207000 — must NOT appear
      const orgAEntry = results.find((r) => r.accountId === cajaAccountId);
      expect(orgAEntry).toBeUndefined();

      // Org B entry with Debe=888888 should appear
      const orgBEntry = results.find((r) => r.accountId === orgBCajaAccountId);
      expect(orgBEntry).toBeDefined();
      expect(orgBEntry!.totalDebit.toFixed(2)).toBe("888888.00");
    });
  });

  // ── findAccountsWithDetail ──────────────────────────────────────────────────

  describe("findAccountsWithDetail", () => {
    it("returns accounts with isDetail field", async () => {
      const accounts = await repo.findAccountsWithDetail(orgId);
      const caja = accounts.find((a) => a.id === cajaAccountId);
      expect(caja).toBeDefined();
      expect(caja).toHaveProperty("isDetail");
      expect(caja!.isDetail).toBe(true);
    });

    it("returns isContraAccount field", async () => {
      const accounts = await repo.findAccountsWithDetail(orgId);
      const caja = accounts.find((a) => a.id === cajaAccountId);
      expect(caja!.isContraAccount).toBe(false);
    });

    it("includes accountType field (type from Account)", async () => {
      const accounts = await repo.findAccountsWithDetail(orgId);
      const caja = accounts.find((a) => a.id === cajaAccountId);
      expect(caja).toHaveProperty("type");
      expect(caja!.type).toBe("ACTIVO");
    });

    it("scopes to org — does not return accounts from other orgs", async () => {
      const accounts = await repo.findAccountsWithDetail(orgId);
      const orgBAcct = accounts.find((a) => a.id === orgBCajaAccountId);
      expect(orgBAcct).toBeUndefined();
    });
  });

  // ── Date range filter ───────────────────────────────────────────────────────

  describe("date range filtering", () => {
    it("excludes entries outside the date range", async () => {
      // Range that only covers January — CI entry is in June, so Caja shouldn't appear
      const narrowRange = {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-01-31"),
      };
      const results = await repo.aggregateByAdjustmentFlag(orgId, narrowRange, false);
      const caja = results.find((r) => r.accountId === cajaAccountId);
      // Both CI (June) and CE (July) are outside January range
      expect(caja).toBeUndefined();
    });

    it("includes entries that fall within the range boundaries (inclusive)", async () => {
      // Range that covers exactly the CI entry date (2025-06-15)
      const exactRange = {
        dateFrom: new Date("2025-06-15"),
        dateTo: new Date("2025-06-15"),
      };
      const results = await repo.aggregateByAdjustmentFlag(orgId, exactRange, false);
      const caja = results.find((r) => r.accountId === cajaAccountId);
      expect(caja).toBeDefined();
      // Only the CI entry (Debe=207000) — CE is in July
      expect(caja!.totalDebit.toFixed(2)).toBe("207000.00");
      expect(caja!.totalCredit.toFixed(2)).toBe("0.00");
    });
  });
});
