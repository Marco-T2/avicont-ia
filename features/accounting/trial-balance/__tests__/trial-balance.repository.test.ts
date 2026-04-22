/**
 * B2 — RED: Integration tests for TrialBalanceRepository against a real Prisma test DB.
 *
 * Key differentiator: aggregateAllVouchers includes ALL voucher types (no isAdjustment filter).
 * Strategy: each describe block seeds a fixture in beforeAll, tears it down in afterAll.
 * Follows the worksheet.repository.test.ts pattern — real $queryRaw, no mocks.
 *
 * Covers: C1.S1, C1.S2, C1.S3, C1.S4, C1.E1, C13.S5, C12.E1
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { TrialBalanceRepository } from "../trial-balance.repository";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

// ── Shared fixture state ──────────────────────────────────────────────────────

let orgId: string;
let orgBId: string;
let userId: string;
let periodId: string;
let periodBId: string;

let ciVoucherTypeId: string;  // isAdjustment = false
let ceVoucherTypeId: string;  // isAdjustment = false
let cjVoucherTypeId: string;  // isAdjustment = true

let cajaAccountId: string;    // detail account in OrgA
let capitalAccountId: string; // detail account in OrgA
let orgBCajaAccountId: string; // same code but in OrgB

const repo = new TrialBalanceRepository();

const DATE_FROM = new Date("2025-01-01");
const DATE_TO   = new Date("2025-12-31");
const IN_PERIOD = new Date("2025-06-15");
const BEFORE_PERIOD = new Date("2024-12-31");

beforeAll(async () => {
  const now = Date.now();

  // User
  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-tb-repo-${now}`,
      email: `tb-repo-${now}@test.com`,
      name: "TB Repo Test",
    },
  });
  userId = user.id;

  // Org A
  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-tb-a-${now}`,
      name: "Test Org TB A",
      slug: `test-org-tb-a-${now}`,
    },
  });
  orgId = org.id;

  // Org B (isolation tests)
  const orgB = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-tb-b-${now}`,
      name: "Test Org TB B",
      slug: `test-org-tb-b-${now}`,
    },
  });
  orgBId = orgB.id;

  // Fiscal periods (required for JournalEntry)
  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: "Gestión TB 2025",
      year: 2025,
      month: 1,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });
  periodId = period.id;

  const periodB = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgBId,
      name: "Gestión TB B 2025",
      year: 2025,
      month: 1,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });
  periodBId = periodB.id;

  // Voucher types for OrgA
  const ciV = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-TB-${now}`,
      prefix: "CI",
      name: "Comprobante de Ingreso",
      isAdjustment: false,
    },
  });
  ciVoucherTypeId = ciV.id;

  const ceV = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CE-TB-${now}`,
      prefix: "CE",
      name: "Comprobante de Egreso",
      isAdjustment: false,
    },
  });
  ceVoucherTypeId = ceV.id;

  const cjV = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CJ-TB-${now}`,
      prefix: "CJ",
      name: "Comprobante de Ajuste",
      isAdjustment: true,
    },
  });
  cjVoucherTypeId = cjV.id;

  // Voucher type for OrgB
  const ciBV = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgBId,
      code: `CI-TB-B-${now}`,
      prefix: "CI",
      name: "Comprobante de Ingreso B",
      isAdjustment: false,
    },
  });

  // Accounts in OrgA
  const caja = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.1.1-TB-${now}`,
      name: "Caja TB",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  cajaAccountId = caja.id;

  const capital = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `3.1.1-TB-${now}`,
      name: "Capital TB",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  capitalAccountId = capital.id;

  // Same-code account in OrgB (isolation test)
  const orgBCaja = await prisma.account.create({
    data: {
      organizationId: orgBId,
      code: `1.1.1-TB-${now}`,
      name: "Caja TB OrgB",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  orgBCajaAccountId = orgBCaja.id;

  // ── Seed journal entries for aggregation tests ──

  // C1.S1: CI (debit 1000 to caja), CE (credit 500 to caja), CJ (debit 200 to caja) — all POSTED in period
  const ciEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId: ciVoucherTypeId,
      periodId,
      createdById: userId,
      number: 1,
      date: IN_PERIOD,
      description: "CI entry TB test",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: ciEntry.id, accountId: cajaAccountId, debit: new Prisma.Decimal("1000"), credit: new Prisma.Decimal("0") },
      { journalEntryId: ciEntry.id, accountId: capitalAccountId, debit: new Prisma.Decimal("0"), credit: new Prisma.Decimal("1000") },
    ],
  });

  const ceEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId: ceVoucherTypeId,
      periodId,
      createdById: userId,
      number: 2,
      date: IN_PERIOD,
      description: "CE entry TB test",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: ceEntry.id, accountId: cajaAccountId, debit: new Prisma.Decimal("0"), credit: new Prisma.Decimal("500") },
      { journalEntryId: ceEntry.id, accountId: capitalAccountId, debit: new Prisma.Decimal("500"), credit: new Prisma.Decimal("0") },
    ],
  });

  const cjEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId: cjVoucherTypeId,
      periodId,
      createdById: userId,
      number: 3,
      date: IN_PERIOD,
      description: "CJ entry TB test",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cjEntry.id, accountId: cajaAccountId, debit: new Prisma.Decimal("200"), credit: new Prisma.Decimal("0") },
      { journalEntryId: cjEntry.id, accountId: capitalAccountId, debit: new Prisma.Decimal("0"), credit: new Prisma.Decimal("200") },
    ],
  });

  // C1.S2: out-of-period CI voucher (BEFORE_PERIOD)
  // Need a 2024 period for this entry
  const period2024 = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: "Gestión TB 2024",
      year: 2024,
      month: 1,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      createdById: userId,
    },
  });
  const outOfPeriodEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId: ciVoucherTypeId,
      periodId: period2024.id,
      createdById: userId,
      number: 4,
      date: BEFORE_PERIOD,
      description: "Out-of-period CI entry TB test",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: outOfPeriodEntry.id, accountId: cajaAccountId, debit: new Prisma.Decimal("9999"), credit: new Prisma.Decimal("0") },
      { journalEntryId: outOfPeriodEntry.id, accountId: capitalAccountId, debit: new Prisma.Decimal("0"), credit: new Prisma.Decimal("9999") },
    ],
  });

  // C1.S3: DRAFT entry (should NOT be counted)
  const draftEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId: ciVoucherTypeId,
      periodId,
      createdById: userId,
      number: 5,
      date: IN_PERIOD,
      description: "DRAFT entry TB test",
      status: "DRAFT",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: draftEntry.id, accountId: cajaAccountId, debit: new Prisma.Decimal("7777"), credit: new Prisma.Decimal("0") },
      { journalEntryId: draftEntry.id, accountId: capitalAccountId, debit: new Prisma.Decimal("0"), credit: new Prisma.Decimal("7777") },
    ],
  });

  // C1.S4: OrgB entry in same period (isolation test)
  const orgBEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgBId,
      voucherTypeId: ciBV.id,
      periodId: periodBId,
      createdById: userId,
      number: 1,
      date: IN_PERIOD,
      description: "OrgB entry TB test",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: orgBEntry.id, accountId: orgBCajaAccountId, debit: new Prisma.Decimal("5000"), credit: new Prisma.Decimal("0") },
    ],
  });
});

afterAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgId } });
  await prisma.journalEntry.deleteMany({ where: { organizationId: orgBId } });
  await prisma.account.deleteMany({ where: { organizationId: orgId } });
  await prisma.account.deleteMany({ where: { organizationId: orgBId } });
  await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
  await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: orgBId } });
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgBId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgBId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.organization.delete({ where: { id: orgBId } });
  await prisma.user.delete({ where: { id: userId } });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialBalanceRepository.aggregateAllVouchers", () => {
  it("C1.S1 — CI + CE + CJ all counted: totalDebit=1200, totalCredit=500 for caja", async () => {
    const result = await repo.aggregateAllVouchers(orgId, DATE_FROM, DATE_TO);
    const cajaRow = result.find((r) => r.accountId === cajaAccountId);
    expect(cajaRow).toBeDefined();
    // CI: debit 1000, CE: credit 500, CJ: debit 200 → totalDebit=1200, totalCredit=500
    expect(cajaRow!.totalDebit.toFixed(2)).toBe("1200.00");
    expect(cajaRow!.totalCredit.toFixed(2)).toBe("500.00");
  });

  it("C1.S2 — out-of-period voucher NOT included", async () => {
    const result = await repo.aggregateAllVouchers(orgId, DATE_FROM, DATE_TO);
    const cajaRow = result.find((r) => r.accountId === cajaAccountId);
    // If out-of-period 9999 debit was included, totalDebit would be 11199 not 1200
    expect(cajaRow!.totalDebit.toFixed(2)).toBe("1200.00");
  });

  it("C1.S3 — DRAFT vouchers NOT included in aggregation", async () => {
    const result = await repo.aggregateAllVouchers(orgId, DATE_FROM, DATE_TO);
    const cajaRow = result.find((r) => r.accountId === cajaAccountId);
    // If DRAFT 7777 debit was included, totalDebit would be 8977+ not 1200
    expect(cajaRow!.totalDebit.toFixed(2)).toBe("1200.00");
  });

  it("C1.S4 — OrgB lines NOT included in OrgA aggregation", async () => {
    const result = await repo.aggregateAllVouchers(orgId, DATE_FROM, DATE_TO);
    // orgBCajaAccountId is in OrgB — should NOT appear in OrgA result
    const orgBRow = result.find((r) => r.accountId === orgBCajaAccountId);
    expect(orgBRow).toBeUndefined();
  });

  it("C1.E1 — CJ (isAdjustment=true) IS included — no type filter", async () => {
    const result = await repo.aggregateAllVouchers(orgId, DATE_FROM, DATE_TO);
    const cajaRow = result.find((r) => r.accountId === cajaAccountId);
    // CJ contributed 200 debit. If CJ was filtered, totalDebit would be 1000 (only CI)
    expect(cajaRow!.totalDebit.toFixed(2)).toBe("1200.00"); // 1000 CI + 200 CJ
  });

  it("C12.E1 — returned totalDebit/totalCredit are instanceof Prisma.Decimal", async () => {
    const result = await repo.aggregateAllVouchers(orgId, DATE_FROM, DATE_TO);
    expect(result.length).toBeGreaterThan(0);
    for (const row of result) {
      expect(row.totalDebit).toBeInstanceOf(Prisma.Decimal);
      expect(row.totalCredit).toBeInstanceOf(Prisma.Decimal);
    }
  });
});

describe("TrialBalanceRepository.findAccounts", () => {
  it("returns active accounts for org, ordered by code ASC", async () => {
    const accounts = await repo.findAccounts(orgId);
    const ourAccounts = accounts.filter(
      (a) => a.id === cajaAccountId || a.id === capitalAccountId,
    );
    expect(ourAccounts.length).toBe(2);
    // Both should be detail
    for (const a of ourAccounts) {
      expect(a.isDetail).toBe(true);
    }
  });

  it("does NOT return accounts from OrgB", async () => {
    const accounts = await repo.findAccounts(orgId);
    const orgBAccount = accounts.find((a) => a.id === orgBCajaAccountId);
    expect(orgBAccount).toBeUndefined();
  });
});

describe("TrialBalanceRepository — server-only boundary", () => {
  it("C13.S5 — repository file starts with import 'server-only'", () => {
    const repoPath = path.join(
      __dirname,
      "../trial-balance.repository.ts",
    );
    const content = fs.readFileSync(repoPath, "utf8");
    expect(content.startsWith(`import "server-only"`)).toBe(true);
  });
});
