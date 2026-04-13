// Smoke tests para los exporters de PDF (pdfmake) y Excel (exceljs).
// Verifican únicamente que las funciones retornan un Buffer válido y no lanzán excepciones.
// No se parsea el contenido del PDF ni del XLSX — la verificación de contenido es manual.

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type { BalanceSheet, IncomeStatement, SubtypeGroup } from "../financial-statements.types";
import { exportBalanceSheetPdf, exportIncomeStatementPdf } from "../exporters/pdf.exporter";
import {
  exportBalanceSheetExcel,
  exportIncomeStatementExcel,
} from "../exporters/excel.exporter";

// ── Helper ──

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Fixture: Balance General mínimo ──

const sampleSubtypeGroupActivo: SubtypeGroup = {
  subtype: AccountSubtype.ACTIVO_CORRIENTE,
  label: "Activo Corriente",
  accounts: [
    { accountId: "acc-1", code: "1.1.01", name: "Caja", balance: D("5000.00") },
    { accountId: "acc-2", code: "1.1.02", name: "Bancos", balance: D("15000.00") },
  ],
  total: D("20000.00"),
};

const sampleSubtypeGroupPasivo: SubtypeGroup = {
  subtype: AccountSubtype.PASIVO_CORRIENTE,
  label: "Pasivo Corriente",
  accounts: [{ accountId: "acc-3", code: "2.1.01", name: "Proveedores", balance: D("8000.00") }],
  total: D("8000.00"),
};

const sampleSubtypeGroupPatrimonio: SubtypeGroup = {
  subtype: AccountSubtype.PATRIMONIO_CAPITAL,
  label: "Patrimonio Capital",
  accounts: [
    {
      accountId: "acc-4",
      code: "3.1.01",
      name: "Capital Social",
      balance: D("12000.00"),
    },
  ],
  total: D("12000.00"),
};

const sampleBalanceSheet: BalanceSheet = {
  orgId: "org-test",
  current: {
    asOfDate: new Date("2025-12-31"),
    assets: {
      groups: [sampleSubtypeGroupActivo],
      total: D("20000.00"),
    },
    liabilities: {
      groups: [sampleSubtypeGroupPasivo],
      total: D("8000.00"),
    },
    equity: {
      groups: [sampleSubtypeGroupPatrimonio],
      total: D("12000.00"),
      retainedEarningsOfPeriod: D("0.00"),
    },
    imbalanced: false,
    imbalanceDelta: D("0.00"),
    preliminary: false,
  },
};

// Variante con estado preliminar (activa watermark en PDF y banner en Excel)
const sampleBalanceSheetPreliminary: BalanceSheet = {
  ...sampleBalanceSheet,
  current: { ...sampleBalanceSheet.current, preliminary: true },
};

// ── Fixture: Estado de Resultados mínimo ──

const sampleSubtypeIngreso: SubtypeGroup = {
  subtype: AccountSubtype.INGRESO_OPERATIVO,
  label: "Ingreso Operativo",
  accounts: [
    { accountId: "acc-5", code: "4.1.01", name: "Ventas", balance: D("30000.00") },
  ],
  total: D("30000.00"),
};

const sampleSubtypeGasto: SubtypeGroup = {
  subtype: AccountSubtype.GASTO_OPERATIVO,
  label: "Gasto Operativo",
  accounts: [
    { accountId: "acc-6", code: "5.1.01", name: "Sueldos", balance: D("18000.00") },
  ],
  total: D("18000.00"),
};

const sampleIncomeStatement: IncomeStatement = {
  orgId: "org-test",
  current: {
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
    income: {
      groups: [sampleSubtypeIngreso],
      total: D("30000.00"),
    },
    expenses: {
      groups: [sampleSubtypeGasto],
      total: D("18000.00"),
    },
    operatingIncome: D("12000.00"),
    netIncome: D("12000.00"),
    preliminary: false,
  },
};

// ── Tests ──

describe("exporters — smoke tests", () => {
  describe("PDF", () => {
    it("exportBalanceSheetPdf retorna un Buffer PDF no trivial", async () => {
      const result = await exportBalanceSheetPdf(sampleBalanceSheet, "Empresa Demo S.R.L.");
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(100);
      // Verifica firma mágica %PDF al inicio del archivo
      expect(result.slice(0, 4).toString()).toBe("%PDF");
    });

    it("exportBalanceSheetPdf con preliminary=true retorna Buffer válido", async () => {
      const result = await exportBalanceSheetPdf(
        sampleBalanceSheetPreliminary,
        "Empresa Demo S.R.L.",
      );
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(100);
    });

    it("exportIncomeStatementPdf retorna un Buffer PDF no trivial", async () => {
      const result = await exportIncomeStatementPdf(sampleIncomeStatement, "Empresa Demo S.R.L.");
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(100);
      expect(result.slice(0, 4).toString()).toBe("%PDF");
    });
  });

  describe("Excel", () => {
    it("exportBalanceSheetExcel retorna un Buffer XLSX no trivial", async () => {
      const result = await exportBalanceSheetExcel(sampleBalanceSheet, "Empresa Demo S.R.L.");
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(100);
    });

    it("exportIncomeStatementExcel retorna un Buffer XLSX no trivial", async () => {
      const result = await exportIncomeStatementExcel(
        sampleIncomeStatement,
        "Empresa Demo S.R.L.",
      );
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(100);
    });
  });
});
