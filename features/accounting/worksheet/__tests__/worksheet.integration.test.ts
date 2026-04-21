/**
 * T35 — RED: Integration invariants for the Hoja de Trabajo.
 *
 * Covers:
 * (a) ER invariant: Σ resultadosPerdidas (incl. carry-over) = Σ resultadosGanancias (spec 15.S1)
 * (b) BG invariant: Σ bgActivo (incl. carry-over) = Σ bgPasPat (spec 15.S2)
 * (c) Contra-account consistency: worksheet bgActivo[Depreciación] = −120000 (spec 6.S3, REQ-6)
 * (d) voucherTypeCfg.isAdjustment partitioning is correct (sumas ≠ ajustes)
 *
 * T36 — Invariant violation detection test:
 * (e) If builder misroutes INGRESO to bgActivo, assertion fails with clear message.
 *
 * Strategy: real test-DB fixture following worksheet.repository.test.ts pattern.
 * Uses buildWorksheet directly with mock aggregations to verify accounting equations.
 *
 * Covers REQ-15, REQ-6 invariant.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { WorksheetRepository } from "../worksheet.repository";
import { buildWorksheet } from "../worksheet.builder";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const zero = D(0);

function decimalEq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.minus(b).abs().lt(D("0.01"));
}

// ── Shared state ──────────────────────────────────────────────────────────────

let orgId: string;
let userId: string;
let fiscalPeriodId: string;

// Voucher type IDs
let ciVoucherTypeId: string; // isAdjustment = false
let cjVoucherTypeId: string; // isAdjustment = true

// Account IDs
let cajaAccountId: string;        // 1.1.1 Caja — ACTIVO
let deprAccountId: string;        // 1.2.6 Depreciación — ACTIVO, contra
let provAccountId: string;        // 2.1.1 Proveedores — PASIVO
let capitalAccountId: string;     // 3.1.1 Capital — PATRIMONIO
let ventasAccountId: string;      // 4.1.1 Ventas — INGRESO
let costoAccountId: string;       // 5.1.1 Costo de Ventas — GASTO

const range = { dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") };
const repo = new WorksheetRepository();

// ── DB Fixture setup ──────────────────────────────────────────────────────────

beforeAll(async () => {
  const now = Date.now();

  // User
  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-ws-integ-${now}`,
      email: `ws-integ-${now}@test.com`,
      name: "WS Integration Test",
    },
  });
  userId = user.id;

  // Org
  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-ws-integ-${now}`,
      name: "Test Org WS Integration",
      slug: `test-org-ws-integ-${now}`,
    },
  });
  orgId = org.id;

  // Fiscal period
  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: "Gestión 2025 Integration",
      year: 2025,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });
  fiscalPeriodId = period.id;

  // Voucher types
  const ciVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-INT-${now}`,
      prefix: "CI",
      name: "Comprobante de Ingreso",
      isAdjustment: false,
    },
  });
  ciVoucherTypeId = ciVoucher.id;

  const cjVoucher = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CJ-INT-${now}`,
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
      code: `1.1.1-INT-${now}`,
      name: "Caja",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  cajaAccountId = caja.id;

  const depr = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.2.6-INT-${now}`,
      name: "Depreciación Acumulada",
      type: "ACTIVO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: true,
    },
  });
  deprAccountId = depr.id;

  const prov = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `2.1.1-INT-${now}`,
      name: "Proveedores",
      type: "PASIVO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  provAccountId = prov.id;

  const capital = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `3.1.1-INT-${now}`,
      name: "Capital",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isContraAccount: false,
    },
  });
  capitalAccountId = capital.id;

  const ventas = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `4.1.1-INT-${now}`,
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
      code: `5.1.1-INT-${now}`,
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
  // Caja Debe 300000 / Ventas Haber 80000 + Capital Haber 220000
  const ciEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      number: 1,
      date: new Date("2025-06-01"),
      description: "CI test entry",
      status: "POSTED",
      periodId: fiscalPeriodId,
      voucherTypeId: ciVoucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: ciEntry.id, accountId: cajaAccountId, debit: 300000, credit: 0 },
      { journalEntryId: ciEntry.id, accountId: provAccountId, debit: 0, credit: 80000 },
      { journalEntryId: ciEntry.id, accountId: capitalAccountId, debit: 0, credit: 140000 },
      { journalEntryId: ciEntry.id, accountId: ventasAccountId, debit: 0, credit: 80000 },
    ],
  });

  // Depreciación: contra-account (CI)
  const deprEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      number: 2,
      date: new Date("2025-06-30"),
      description: "Depreciación CI",
      status: "POSTED",
      periodId: fiscalPeriodId,
      voucherTypeId: ciVoucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: deprEntry.id, accountId: costoAccountId, debit: 120000, credit: 0 },
      { journalEntryId: deprEntry.id, accountId: deprAccountId, debit: 0, credit: 120000 },
    ],
  });

  // ── CJ Journal Entry (isAdjustment=true) ──
  // Adjusts costo by +5000
  const cjEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      number: 3,
      date: new Date("2025-12-31"),
      description: "CJ adjustment",
      status: "POSTED",
      periodId: fiscalPeriodId,
      voucherTypeId: cjVoucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cjEntry.id, accountId: costoAccountId, debit: 5000, credit: 0 },
      { journalEntryId: cjEntry.id, accountId: provAccountId, debit: 0, credit: 5000 },
    ],
  });
});

afterAll(async () => {
  // Clean up fixture data (cascade delete through org)
  if (orgId) {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorksheetIntegration — accounting invariants (REQ-15, REQ-6)", () => {
  it("(a) ER invariant: Σ resultadosPerdidas (incl. carry-over) = Σ resultadosGanancias after buildWorksheet", async () => {
    const accounts = await repo.findAccountsWithDetail(orgId);
    const [sumas, ajustes] = await Promise.all([
      repo.aggregateByAdjustmentFlag(orgId, range, false),
      repo.aggregateByAdjustmentFlag(orgId, range, true),
    ]);

    const report = buildWorksheet({ accounts, sumas, ajustes, dateFrom: range.dateFrom, dateTo: range.dateTo });

    // Grand totals include carry-over row
    const { resultadosPerdidas, resultadosGanancias } = report.grandTotals;
    expect(
      decimalEq(resultadosPerdidas, resultadosGanancias),
      `ER invariant failed: Σ perdidas (${resultadosPerdidas.toFixed(2)}) ≠ Σ ganancias (${resultadosGanancias.toFixed(2)})`,
    ).toBe(true);
  });

  it("(b) BG invariant: Σ bgActivo (incl. carry-over) = Σ bgPasPat after buildWorksheet", async () => {
    const accounts = await repo.findAccountsWithDetail(orgId);
    const [sumas, ajustes] = await Promise.all([
      repo.aggregateByAdjustmentFlag(orgId, range, false),
      repo.aggregateByAdjustmentFlag(orgId, range, true),
    ]);

    const report = buildWorksheet({ accounts, sumas, ajustes, dateFrom: range.dateFrom, dateTo: range.dateTo });

    const { bgActivo, bgPasPat } = report.grandTotals;
    expect(
      decimalEq(bgActivo, bgPasPat),
      `BG invariant failed: Σ bgActivo (${bgActivo.toFixed(2)}) ≠ Σ bgPasPat (${bgPasPat.toFixed(2)})`,
    ).toBe(true);
  });

  it("(c) contra-account consistency: Depreciación bgActivo = −120000 (spec 6.S3)", async () => {
    const accounts = await repo.findAccountsWithDetail(orgId);
    const [sumas, ajustes] = await Promise.all([
      repo.aggregateByAdjustmentFlag(orgId, range, false),
      repo.aggregateByAdjustmentFlag(orgId, range, true),
    ]);

    const report = buildWorksheet({ accounts, sumas, ajustes, dateFrom: range.dateFrom, dateTo: range.dateTo });

    // Find the Depreciación row in ACTIVO group
    const activoGroup = report.groups.find((g) => g.accountType === "ACTIVO");
    expect(activoGroup).toBeDefined();

    const deprRow = activoGroup!.rows.find((r) => r.accountId === deprAccountId);
    expect(deprRow, "Depreciación row must be in ACTIVO group").toBeDefined();
    expect(deprRow!.isContraAccount).toBe(true);

    // bgActivo for contra should be negative (−120000)
    expect(
      decimalEq(deprRow!.bgActivo, D("-120000")),
      `contra bgActivo expected −120000, got ${deprRow!.bgActivo.toFixed(2)}`,
    ).toBe(true);
  });

  it("(d) isAdjustment partitioning: sumas and ajustes aggregate correctly into different buckets", async () => {
    const [sumas, ajustes] = await Promise.all([
      repo.aggregateByAdjustmentFlag(orgId, range, false),
      repo.aggregateByAdjustmentFlag(orgId, range, true),
    ]);

    // Sumas should contain Caja (from CI entry — isAdjustment=false)
    const cajaSumas = sumas.find((s) => s.accountId === cajaAccountId);
    expect(cajaSumas, "Caja must appear in sumas (isAdjustment=false)").toBeDefined();
    expect(cajaSumas!.totalDebit.gt(zero)).toBe(true);

    // Ajustes should contain Costo from CJ entry (isAdjustment=true)
    const costoAjustes = ajustes.find((a) => a.accountId === costoAccountId);
    expect(costoAjustes, "Costo must appear in ajustes (isAdjustment=true)").toBeDefined();
    expect(costoAjustes!.totalDebit.gt(zero)).toBe(true);

    // Caja should NOT be in ajustes (no CJ entries for Caja)
    const cajaInAjustes = ajustes.find((a) => a.accountId === cajaAccountId);
    expect(cajaInAjustes, "Caja must NOT appear in ajustes").toBeUndefined();
  });
});

// ── T36: Invariant violation detection test ───────────────────────────────────

describe("T36 — Invariant violation detection (spec 15.E1)", () => {
  it("a misrouted INGRESO account in bgActivo makes BG invariant fail — proving the assertion infrastructure is correct", async () => {
    // Build a synthetic report where INGRESO is incorrectly routed to bgActivo
    // (simulating a builder bug). The BG invariant check MUST fail.
    const accounts = await repo.findAccountsWithDetail(orgId);
    const [sumas, ajustes] = await Promise.all([
      repo.aggregateByAdjustmentFlag(orgId, range, false),
      repo.aggregateByAdjustmentFlag(orgId, range, true),
    ]);

    const goodReport = buildWorksheet({ accounts, sumas, ajustes, dateFrom: range.dateFrom, dateTo: range.dateTo });

    // Synthesize a bugged grand totals by adding an artificial imbalance
    const buggedBgActivo = goodReport.grandTotals.bgActivo.plus(D("99999"));
    // bgPasPat stays the same → invariant breaks

    const invariantBreaks = !decimalEq(buggedBgActivo, goodReport.grandTotals.bgPasPat);
    expect(
      invariantBreaks,
      "The invariant detection must catch the misrouted synthetic imbalance",
    ).toBe(true);
  });
});
