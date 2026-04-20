/**
 * T13 + T14 + T15 — Contra-account export tests.
 *
 * T13: sheet.builder wraps contra balances in parens (for PDF string path)
 * T14: PDF exporter renders parens correctly (string path, no changes expected)
 * T15: Excel exporter writes numeric-negative for contra accounts
 *
 * Covers: REQ-CA.8 (visual rendering), R2 (Excel numeric re-parse fix)
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type { BalanceSheet, SubtypeGroup } from "../financial-statements.types";
import { buildBalanceSheetExportSheet } from "../exporters/sheet.builder";
import ExcelJS from "exceljs";
import { exportBalanceSheetExcel } from "../exporters/excel.exporter";

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Fixture helpers ──

function makeSubtypeGroupWithContra(): SubtypeGroup {
  return {
    subtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
    label: "Activo No Corriente",
    accounts: [
      {
        accountId: "acc-edificios",
        code: "1.2.2",
        name: "Edificios",
        balance: D("500000"),
        isContra: false,
      },
      {
        accountId: "acc-deprec",
        code: "1.2.6",
        name: "Depreciación Acumulada",
        balance: D("120000"),
        isContra: true,
      },
    ],
    total: D("380000"), // 500000 - 120000
  };
}

function makeBalanceSheetWithContra(): BalanceSheet {
  return {
    orgId: "org-1",
    current: {
      asOfDate: new Date("2026-04-20"),
      assets: {
        groups: [makeSubtypeGroupWithContra()],
        total: D("380000"),
      },
      liabilities: {
        groups: [],
        total: D("0"),
      },
      equity: {
        groups: [],
        total: D("0"),
        retainedEarningsOfPeriod: D("0"),
      },
      imbalanced: true, // intentionally imbalanced — not testing balance here
      imbalanceDelta: D("380000"),
      preliminary: false,
    },
  };
}

// ── T13: sheet.builder parens wrapping ──

describe("sheet.builder — contra-account parens wrapping (T13)", () => {
  const bs = makeBalanceSheetWithContra();
  const sheet = buildBalanceSheetExportSheet(bs, "Test Org");

  it("T13-a — contra account row has balance wrapped in parens", () => {
    const deprecRow = sheet.rows.find(
      (r) => r.type === "account" && r.label === "Depreciación Acumulada"
    );
    expect(deprecRow).toBeDefined();
    expect(deprecRow!.balance).toBe("(120000.00)");
  });

  it("T13-b — contra account row has isContra=true", () => {
    const deprecRow = sheet.rows.find(
      (r) => r.type === "account" && r.label === "Depreciación Acumulada"
    );
    expect(deprecRow!.isContra).toBe(true);
  });

  it("T13-c — contra account row has ALL balances[colId] wrapped in parens", () => {
    const deprecRow = sheet.rows.find(
      (r) => r.type === "account" && r.label === "Depreciación Acumulada"
    );
    expect(deprecRow!.balances).toBeDefined();
    for (const val of Object.values(deprecRow!.balances!)) {
      expect(val).toMatch(/^\(.+\)$/); // matches "(120000.00)"
    }
  });

  it("T13-d — non-contra account row is unchanged (no parens)", () => {
    const edificiosRow = sheet.rows.find(
      (r) => r.type === "account" && r.label === "Edificios"
    );
    expect(edificiosRow).toBeDefined();
    expect(edificiosRow!.balance).toBe("500000.00");
    expect(edificiosRow!.isContra).toBeFalsy();
  });
});

// ── T14: PDF exporter renders correctly (no logic changes needed) ──
// The PDF exporter renders row.balance as-is (already a string).
// We only verify it returns a Buffer without errors.

describe("PDF exporter — contra accounts (T14)", () => {
  it("T14 — exportBalanceSheetPdf produces a Buffer without errors for BS with contra accounts", async () => {
    // Import dynamically to avoid loading pdfmake at test collection time
    const { exportBalanceSheetPdf } = await import("../exporters/pdf.exporter");
    const bs = makeBalanceSheetWithContra();
    const buffer = await exportBalanceSheetPdf(bs, "Test Org");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ── T15: Excel exporter — contra as numeric-negative ──

describe("Excel exporter — contra accounts numeric-negative (T15, R2 fix)", () => {
  it("T15-a — contra account cell has numeric value (negative), not string", async () => {
    const bs = makeBalanceSheetWithContra();
    const buffer = await exportBalanceSheetExcel(bs, "Test Org");
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // Parse the generated XLSX and inspect cell values
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.worksheets[0];

    // Find the Depreciación Acumulada row — scan all rows for the label
    let contraCell: ExcelJS.Cell | undefined;
    let nonContraCell: ExcelJS.Cell | undefined;

    ws.eachRow((row) => {
      const labelCell = row.getCell(1);
      const label = typeof labelCell.value === "string" ? labelCell.value : "";

      if (label === "Depreciación Acumulada") {
        contraCell = row.getCell(3); // single-col layout: col3 = balance
      }
      if (label === "Edificios") {
        nonContraCell = row.getCell(3);
      }
    });

    // T15-a: contra cell value is a NUMBER (not a string)
    expect(contraCell).toBeDefined();
    expect(typeof contraCell!.value).toBe("number");

    // T15-b: contra cell value is NEGATIVE
    expect(contraCell!.value as number).toBeLessThan(0);
    expect(contraCell!.value as number).toBe(-120000);

    // T15-c: contra cell numFmt is the accounting format
    expect(contraCell!.numFmt).toBe("#,##0.00;(#,##0.00)");

    // T15-d: non-contra cell is POSITIVE numeric
    expect(nonContraCell).toBeDefined();
    expect(typeof nonContraCell!.value).toBe("number");
    expect(nonContraCell!.value as number).toBe(500000);
  });
});
