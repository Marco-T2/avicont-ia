/**
 * T08 — PDF exporter smoke tests.
 *
 * Covers: REQ-7 (pérdida parentheses), REQ-11 (pdf format), REQ-12 (A4 landscape, header, watermark)
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { exportEquityStatementPdf, MissingOrgNameError } from "../infrastructure/exporters/equity-statement-pdf.exporter";
import type { EquityStatement } from "../domain/equity-statement.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

function makeStatement(overrides: Partial<EquityStatement> = {}): EquityStatement {
  const ZERO = D("0");
  const columnTotals = {
    CAPITAL_SOCIAL: D("5000"),
    APORTES_CAPITALIZAR: ZERO,
    AJUSTE_CAPITAL: ZERO,
    RESERVA_LEGAL: ZERO,
    RESULTADOS_ACUMULADOS: D("1000"),
    OTROS_PATRIMONIO: ZERO,
  };

  return {
    orgId: "org-1",
    dateFrom: new Date("2024-01-01"),
    dateTo: new Date("2024-12-31"),
    columns: [
      { key: "CAPITAL_SOCIAL",        label: "Capital Social",        visible: true  },
      { key: "APORTES_CAPITALIZAR",   label: "Aportes p/ Capitalizar", visible: true },
      { key: "AJUSTE_CAPITAL",        label: "Ajuste de Capital",      visible: true  },
      { key: "RESERVA_LEGAL",         label: "Reserva Legal",          visible: true  },
      { key: "RESULTADOS_ACUMULADOS", label: "Resultados Acumulados",  visible: true  },
      { key: "OTROS_PATRIMONIO",      label: "Otros Patrimonio",       visible: false },
    ],
    rows: [
      {
        key: "SALDO_INICIAL",
        label: "Saldo al inicio del período",
        cells: [
          { column: "CAPITAL_SOCIAL",        amount: D("5000") },
          { column: "APORTES_CAPITALIZAR",   amount: ZERO },
          { column: "AJUSTE_CAPITAL",        amount: ZERO },
          { column: "RESERVA_LEGAL",         amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: ZERO },
          { column: "OTROS_PATRIMONIO",      amount: ZERO },
        ],
        total: D("5000"),
      },
      {
        key: "RESULTADO_EJERCICIO",
        label: "Resultado del ejercicio",
        cells: [
          { column: "CAPITAL_SOCIAL",        amount: ZERO },
          { column: "APORTES_CAPITALIZAR",   amount: ZERO },
          { column: "AJUSTE_CAPITAL",        amount: ZERO },
          { column: "RESERVA_LEGAL",         amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: D("1000") },
          { column: "OTROS_PATRIMONIO",      amount: ZERO },
        ],
        total: D("1000"),
      },
      {
        key: "SALDO_FINAL",
        label: "Saldo al cierre del período",
        cells: [
          { column: "CAPITAL_SOCIAL",        amount: D("5000") },
          { column: "APORTES_CAPITALIZAR",   amount: ZERO },
          { column: "AJUSTE_CAPITAL",        amount: ZERO },
          { column: "RESERVA_LEGAL",         amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: D("1000") },
          { column: "OTROS_PATRIMONIO",      amount: ZERO },
        ],
        total: D("6000"),
      },
    ],
    columnTotals,
    grandTotal: D("6000"),
    periodResult: D("1000"),
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
    ...overrides,
  };
}

describe("exportEquityStatementPdf — smoke tests", () => {
  it("buffer starts with %PDF", async () => {
    const result = await exportEquityStatementPdf(makeStatement(), "Cooperativa Test");
    expect(result.buffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("buffer size is in [15_000, 500_000] bytes", async () => {
    const result = await exportEquityStatementPdf(makeStatement(), "Cooperativa Test");
    expect(result.buffer.length).toBeGreaterThan(15_000);
    expect(result.buffer.length).toBeLessThan(500_000);
  });

  it("docDef contains title 'ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO'", async () => {
    const result = await exportEquityStatementPdf(makeStatement(), "Cooperativa Test");
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO");
  });

  it("docDef table body has 3 body rows (header + 3 data rows)", async () => {
    const result = await exportEquityStatementPdf(makeStatement(), "Cooperativa Test");
    const content = result.docDef.content as unknown[];
    const tableEntry = content.find((c) => typeof c === "object" && c !== null && "table" in c) as { table: { body: unknown[] } } | undefined;
    // Header row + 3 data rows = 4 total; body rows (excluding header) = 3
    expect(tableEntry?.table.body.length).toBe(4); // header + 3
  });

  it("pageOrientation is 'landscape'", async () => {
    const result = await exportEquityStatementPdf(makeStatement(), "Cooperativa Test");
    expect(result.docDef.pageOrientation).toBe("landscape");
  });

  it("pageSize is 'A4'", async () => {
    const result = await exportEquityStatementPdf(makeStatement(), "Cooperativa Test");
    expect(result.docDef.pageSize).toBe("A4");
  });

  it("watermark present when preliminary=true", async () => {
    const result = await exportEquityStatementPdf(makeStatement({ preliminary: true }), "Cooperativa Test");
    const watermark = result.docDef.watermark as { text: string } | undefined;
    expect(watermark).toBeDefined();
    expect(watermark?.text).toContain("PRELIMINAR");
  });

  it("no watermark when preliminary=false", async () => {
    const result = await exportEquityStatementPdf(makeStatement({ preliminary: false }), "Cooperativa Test");
    expect(result.docDef.watermark).toBeUndefined();
  });

  it("pérdida rendered with parentheses in table cell", async () => {
    const stmt = makeStatement({
      periodResult: D("-15000"),
      rows: [
        {
          key: "SALDO_INICIAL",
          label: "Saldo al inicio del período",
          cells: [
            { column: "CAPITAL_SOCIAL",        amount: D("0") },
            { column: "APORTES_CAPITALIZAR",   amount: D("0") },
            { column: "AJUSTE_CAPITAL",        amount: D("0") },
            { column: "RESERVA_LEGAL",         amount: D("0") },
            { column: "RESULTADOS_ACUMULADOS", amount: D("0") },
            { column: "OTROS_PATRIMONIO",      amount: D("0") },
          ],
          total: D("0"),
        },
        {
          key: "RESULTADO_EJERCICIO",
          label: "Resultado del ejercicio",
          cells: [
            { column: "CAPITAL_SOCIAL",        amount: D("0") },
            { column: "APORTES_CAPITALIZAR",   amount: D("0") },
            { column: "AJUSTE_CAPITAL",        amount: D("0") },
            { column: "RESERVA_LEGAL",         amount: D("0") },
            { column: "RESULTADOS_ACUMULADOS", amount: D("-15000") },
            { column: "OTROS_PATRIMONIO",      amount: D("0") },
          ],
          total: D("-15000"),
        },
        {
          key: "SALDO_FINAL",
          label: "Saldo al cierre del período",
          cells: [
            { column: "CAPITAL_SOCIAL",        amount: D("0") },
            { column: "APORTES_CAPITALIZAR",   amount: D("0") },
            { column: "AJUSTE_CAPITAL",        amount: D("0") },
            { column: "RESERVA_LEGAL",         amount: D("0") },
            { column: "RESULTADOS_ACUMULADOS", amount: D("-15000") },
            { column: "OTROS_PATRIMONIO",      amount: D("0") },
          ],
          total: D("-15000"),
        },
      ],
    });
    const result = await exportEquityStatementPdf(stmt, "Cooperativa Test");
    const json = JSON.stringify(result.docDef);
    // Parentheses format for negative numbers
    expect(json).toContain("(15.000,00)");
  });

  it("MissingOrgNameError thrown when orgName is empty string", async () => {
    await expect(exportEquityStatementPdf(makeStatement(), "")).rejects.toThrow(MissingOrgNameError);
  });

  // ── Batch 7: N-row rendering + key-based SALDO_FINAL detection ───────────────

  function makeStatementWith5Rows(): EquityStatement {
    const base = makeStatement();
    const ZERO = D("0");
    const typedRow = (
      key: "APORTE_CAPITAL" | "CONSTITUCION_RESERVA",
      label: string,
      csAmount: string,
    ) => ({
      key,
      label,
      cells: [
        { column: "CAPITAL_SOCIAL" as const,        amount: D(csAmount) },
        { column: "APORTES_CAPITALIZAR" as const,   amount: ZERO },
        { column: "AJUSTE_CAPITAL" as const,        amount: ZERO },
        { column: "RESERVA_LEGAL" as const,         amount: ZERO },
        { column: "RESULTADOS_ACUMULADOS" as const, amount: ZERO },
        { column: "OTROS_PATRIMONIO" as const,      amount: ZERO },
      ],
      total: D(csAmount),
    });
    return {
      ...base,
      rows: [
        base.rows[0], // SALDO_INICIAL
        typedRow("APORTE_CAPITAL",       "Aportes de capital del período", "200000"),
        typedRow("CONSTITUCION_RESERVA", "Constitución de reservas",       "10000"),
        base.rows[1], // RESULTADO_EJERCICIO
        base.rows[2], // SALDO_FINAL
      ],
    };
  }

  it("T07 — statement with 5 rows renders 5 data rows (+1 header)", async () => {
    const result = await exportEquityStatementPdf(makeStatementWith5Rows(), "Cooperativa Test");
    const content = result.docDef.content as unknown[];
    const tableEntry = content.find(
      (c) => typeof c === "object" && c !== null && "table" in c,
    ) as { table: { body: unknown[][] } } | undefined;
    expect(tableEntry?.table.body.length).toBe(6); // header + 5 data
  });

  it("T07 — only SALDO_FINAL row has bold cells (not row index 2)", async () => {
    const result = await exportEquityStatementPdf(makeStatementWith5Rows(), "Cooperativa Test");
    const content = result.docDef.content as unknown[];
    const tableEntry = content.find(
      (c) => typeof c === "object" && c !== null && "table" in c,
    ) as { table: { body: Array<Array<{ bold?: boolean }>> } } | undefined;
    const bodyRows = tableEntry!.table.body.slice(1); // drop header
    const boldFlags = bodyRows.map((row) => row.every((cell) => cell.bold === true));
    // Only last row (SALDO_FINAL, index 4) should be all-bold
    expect(boldFlags).toEqual([false, false, false, false, true]);
  });
});
