/**
 * T1 — RED: Verifies that all 5 domain types are importable and have the correct shape.
 * Covers REQ-2.
 */
import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type {
  WorksheetRow,
  WorksheetGroup,
  WorksheetTotals,
  WorksheetFilters,
  WorksheetReport,
} from "../worksheet.types";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("worksheet domain types", () => {
  it("WorksheetRow can be constructed with all 12 Decimal fields", () => {
    const row: WorksheetRow = {
      accountId: "acc-1",
      code: "1.1.1",
      name: "Caja",
      isContraAccount: false,
      accountType: "ACTIVO",
      isCarryOver: false,
      // 12 Decimal columns
      sumasDebe: D("207000"),
      sumasHaber: D("23152"),
      saldoDeudor: D("183848"),
      saldoAcreedor: D("0"),
      ajustesDebe: D("5000"),
      ajustesHaber: D("0"),
      saldoAjDeudor: D("188848"),
      saldoAjAcreedor: D("0"),
      resultadosPerdidas: D("0"),
      resultadosGanancias: D("0"),
      bgActivo: D("188848"),
      bgPasPat: D("0"),
    };

    expect(row.accountId).toBe("acc-1");
    expect(row.code).toBe("1.1.1");
    // All 12 numeric fields are Prisma.Decimal instances
    expect(row.sumasDebe).toBeInstanceOf(Prisma.Decimal);
    expect(row.sumasHaber).toBeInstanceOf(Prisma.Decimal);
    expect(row.saldoDeudor).toBeInstanceOf(Prisma.Decimal);
    expect(row.saldoAcreedor).toBeInstanceOf(Prisma.Decimal);
    expect(row.ajustesDebe).toBeInstanceOf(Prisma.Decimal);
    expect(row.ajustesHaber).toBeInstanceOf(Prisma.Decimal);
    expect(row.saldoAjDeudor).toBeInstanceOf(Prisma.Decimal);
    expect(row.saldoAjAcreedor).toBeInstanceOf(Prisma.Decimal);
    expect(row.resultadosPerdidas).toBeInstanceOf(Prisma.Decimal);
    expect(row.resultadosGanancias).toBeInstanceOf(Prisma.Decimal);
    expect(row.bgActivo).toBeInstanceOf(Prisma.Decimal);
    expect(row.bgPasPat).toBeInstanceOf(Prisma.Decimal);
  });

  it("WorksheetGroup carries accountType, rows, and subtotals", () => {
    const subtotals: WorksheetTotals = {
      sumasDebe: D("0"),
      sumasHaber: D("0"),
      saldoDeudor: D("0"),
      saldoAcreedor: D("0"),
      ajustesDebe: D("0"),
      ajustesHaber: D("0"),
      saldoAjDeudor: D("0"),
      saldoAjAcreedor: D("0"),
      resultadosPerdidas: D("0"),
      resultadosGanancias: D("0"),
      bgActivo: D("0"),
      bgPasPat: D("0"),
    };
    const group: WorksheetGroup = {
      accountType: "ACTIVO",
      rows: [],
      subtotals,
    };
    expect(group.accountType).toBe("ACTIVO");
    expect(group.rows).toHaveLength(0);
    expect(group.subtotals.bgActivo).toBeInstanceOf(Prisma.Decimal);
  });

  it("WorksheetFilters accepts dateFrom, dateTo and optional fiscalPeriodId", () => {
    const f: WorksheetFilters = {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
      fiscalPeriodId: "period-1",
    };
    expect(f.dateFrom).toBeInstanceOf(Date);
    expect(f.dateTo).toBeInstanceOf(Date);
    expect(f.fiscalPeriodId).toBe("period-1");

    // fiscalPeriodId is optional
    const fMinimal: WorksheetFilters = {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    };
    expect(fMinimal.fiscalPeriodId).toBeUndefined();
  });

  it("WorksheetReport carries all required fields", () => {
    const totals: WorksheetTotals = {
      sumasDebe: D("0"),
      sumasHaber: D("0"),
      saldoDeudor: D("0"),
      saldoAcreedor: D("0"),
      ajustesDebe: D("0"),
      ajustesHaber: D("0"),
      saldoAjDeudor: D("0"),
      saldoAjAcreedor: D("0"),
      resultadosPerdidas: D("0"),
      resultadosGanancias: D("0"),
      bgActivo: D("0"),
      bgPasPat: D("0"),
    };
    const report: WorksheetReport = {
      orgId: "org-1",
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
      groups: [],
      carryOverRow: undefined,
      grandTotals: totals,
      imbalanced: false,
      imbalanceDelta: D("0"),
    };
    expect(report.orgId).toBe("org-1");
    expect(report.groups).toHaveLength(0);
    expect(report.imbalanced).toBe(false);
    expect(report.imbalanceDelta).toBeInstanceOf(Prisma.Decimal);
  });
});
