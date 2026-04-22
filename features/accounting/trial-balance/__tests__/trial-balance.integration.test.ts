/**
 * B10 — Integration test for the Balance de Comprobación de Sumas y Saldos.
 *
 * Covers:
 * (a) REQ-1 — ALL voucher types included (CI + CJ, no isAdjustment filter)
 * (b) REQ-5 — Σ sumasDebe = Σ sumasHaber (double-entry invariant at totals)
 * (c) C1.S1 — aggregateAllVouchers returns rows for both CI and CJ voucher types
 * (d) C4.S1 — saldoDeudor = MAX(sumasDebe - sumasHaber, 0) per account
 *
 * Strategy: real test-DB fixture (same pattern as worksheet.integration.test.ts).
 * Seeds one CI entry and one CJ entry; verifies both appear in trial balance.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { TrialBalanceRepository } from "../trial-balance.repository";
import { buildTrialBalance } from "../trial-balance.builder";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

function decimalEq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.minus(b).abs().lt(D("0.01"));
}

// ── Shared state ──────────────────────────────────────────────────────────────

let orgId: string;
let userId: string;
let fiscalPeriodId: string;

let ciVoucherTypeId: string;  // isAdjustment = false
let cjVoucherTypeId: string;  // isAdjustment = true

let cajaAccountId: string;     // 1.1.1 Caja — ACTIVO
let provAccountId: string;     // 2.1.1 Proveedores — PASIVO
let ventasAccountId: string;   // 4.1.1 Ventas — INGRESO
let costoAccountId: string;    // 5.1.1 Costo de Ventas — GASTO

const range = { dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") };
const repo = new TrialBalanceRepository();

// ── DB Fixture setup ──────────────────────────────────────────────────────────

beforeAll(async () => {
  const now = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-tb-integ-${now}`,
      email: `tb-integ-${now}@test.com`,
      name: "TB Integration Test",
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-tb-integ-${now}`,
      name: "Test Org TB Integration",
      slug: `test-org-tb-integ-${now}`,
    },
  });
  orgId = org.id;

  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: "Gestión 2025 TB Integration",
      year: 2025,
      month: 1,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });
  fiscalPeriodId = period.id;

  // Voucher types (one CI, one CJ)
  const ciVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-TB-INT-${now}`,
      prefix: "CI",
      name: "Comprobante de Ingreso",
      isAdjustment: false,
    },
  });
  ciVoucherTypeId = ciVoucher.id;

  const cjVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CJ-TB-INT-${now}`,
      prefix: "CJ",
      name: "Comprobante de Ajuste",
      isAdjustment: true,
    },
  });
  cjVoucherTypeId = cjVoucher.id;

  // Accounts
  const caja = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.1.1-TB-INT-${now}`,
      name: "Caja",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  cajaAccountId = caja.id;

  const prov = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `2.1.1-TB-INT-${now}`,
      name: "Proveedores",
      type: "PASIVO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  provAccountId = prov.id;

  const ventas = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `4.1.1-TB-INT-${now}`,
      name: "Ventas",
      type: "INGRESO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  ventasAccountId = ventas.id;

  const costo = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `5.1.1-TB-INT-${now}`,
      name: "Costo de Ventas",
      type: "GASTO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  costoAccountId = costo.id;

  // ── CI Journal Entry (isAdjustment=false) ──
  // Caja 100000 D / Ventas 60000 C / Proveedores 40000 C
  const ciEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      number: 1,
      date: new Date("2025-06-01"),
      description: "CI test entry for trial balance",
      status: "POSTED",
      periodId: fiscalPeriodId,
      voucherTypeId: ciVoucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: ciEntry.id, accountId: cajaAccountId, debit: 100000, credit: 0 },
      { journalEntryId: ciEntry.id, accountId: ventasAccountId, debit: 0, credit: 60000 },
      { journalEntryId: ciEntry.id, accountId: provAccountId, debit: 0, credit: 40000 },
    ],
  });

  // ── CJ Journal Entry (isAdjustment=true) ──
  // Costo de Ventas 20000 D / Proveedores 20000 C
  // This entry would be EXCLUDED in the worksheet but INCLUDED in trial balance (REQ-1)
  const cjEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      number: 2,
      date: new Date("2025-12-31"),
      description: "CJ adjustment for trial balance",
      status: "POSTED",
      periodId: fiscalPeriodId,
      voucherTypeId: cjVoucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cjEntry.id, accountId: costoAccountId, debit: 20000, credit: 0 },
      { journalEntryId: cjEntry.id, accountId: provAccountId, debit: 0, credit: 20000 },
    ],
  });
});

afterAll(async () => {
  if (orgId) {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialBalance Integration — REQ-1 and REQ-5", () => {
  it("(a) REQ-1 — aggregateAllVouchers includes both CI (isAdjustment=false) and CJ (isAdjustment=true) entries", async () => {
    const movements = await repo.aggregateAllVouchers(orgId, range.dateFrom, range.dateTo);

    // Caja appears from CI entry
    const cajaMov = movements.find((m) => m.accountId === cajaAccountId);
    expect(cajaMov, "Caja must appear in aggregateAllVouchers").toBeDefined();
    expect(cajaMov!.totalDebit.gt(D(0))).toBe(true);

    // Costo appears from CJ entry (isAdjustment=true — must be included, unlike worksheet)
    const costoMov = movements.find((m) => m.accountId === costoAccountId);
    expect(costoMov, "CJ entry Costo must appear in aggregateAllVouchers (REQ-1)").toBeDefined();
    expect(costoMov!.totalDebit.gt(D(0))).toBe(true);
  });

  it("(b) REQ-5 — Σ sumasDebe = Σ sumasHaber at report totals (double-entry invariant)", async () => {
    const [accounts, movements] = await Promise.all([
      repo.findAccounts(orgId),
      repo.aggregateAllVouchers(orgId, range.dateFrom, range.dateTo),
    ]);

    const report = buildTrialBalance({
      accounts,
      movements,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });

    // Double-entry invariant: total debits must equal total credits
    expect(
      decimalEq(report.totals.sumasDebe, report.totals.sumasHaber),
      `REQ-5 double-entry invariant: sumasDebe (${report.totals.sumasDebe.toFixed(2)}) ≠ sumasHaber (${report.totals.sumasHaber.toFixed(2)})`,
    ).toBe(true);
  });

  it("(c) C1.S1 — aggregateAllVouchers returns correct sumas for each account", async () => {
    const movements = await repo.aggregateAllVouchers(orgId, range.dateFrom, range.dateTo);

    // Caja: CI 100000 D / 0 C
    const cajaMov = movements.find((m) => m.accountId === cajaAccountId)!;
    expect(decimalEq(cajaMov.totalDebit, D(100000))).toBe(true);
    expect(decimalEq(cajaMov.totalCredit, D(0))).toBe(true);

    // Proveedores: CI 40000 C + CJ 20000 C = 60000 C (both voucher types aggregated)
    const provMov = movements.find((m) => m.accountId === provAccountId)!;
    expect(decimalEq(provMov.totalCredit, D(60000)), `Proveedores totalCredit should be 60000 (CI 40000 + CJ 20000), got ${provMov.totalCredit.toFixed(2)}`).toBe(true);
  });

  it("(d) C4.S1 — saldoDeudor = MAX(sumasDebe - sumasHaber, 0) for Caja", async () => {
    const [accounts, movements] = await Promise.all([
      repo.findAccounts(orgId),
      repo.aggregateAllVouchers(orgId, range.dateFrom, range.dateTo),
    ]);

    const report = buildTrialBalance({
      accounts,
      movements,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });

    const cajaRow = report.rows.find((r) => r.accountId === cajaAccountId);
    expect(cajaRow, "Caja row must be in trial balance").toBeDefined();

    // saldoDeudor = MAX(100000 - 0, 0) = 100000
    expect(decimalEq(cajaRow!.saldoDeudor, D(100000))).toBe(true);
    // saldoAcreedor = MAX(0 - 100000, 0) = 0
    expect(decimalEq(cajaRow!.saldoAcreedor, D(0))).toBe(true);
  });
});
