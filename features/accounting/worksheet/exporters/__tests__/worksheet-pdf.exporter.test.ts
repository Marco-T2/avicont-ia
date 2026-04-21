/**
 * T21 — RED: PDF exporter snapshot tests.
 *
 * Validates structural properties of the generated PDF buffer.
 * Does NOT assert visual layout (font sizes, exact column widths) — those
 * are confirmed manually via the apply-phase PDF prototype pause.
 *
 * Covers REQ-12: A4 landscape, single page (no pageBreakBefore chunking).
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { exportWorksheetPdf } from "../worksheet-pdf.exporter";
import type { WorksheetReport } from "../../worksheet.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const z = () => D(0);

function makeZeroTotals() {
  return {
    sumasDebe: z(), sumasHaber: z(), saldoDeudor: z(), saldoAcreedor: z(),
    ajustesDebe: z(), ajustesHaber: z(), saldoAjDeudor: z(), saldoAjAcreedor: z(),
    resultadosPerdidas: z(), resultadosGanancias: z(), bgActivo: z(), bgPasPat: z(),
  };
}

/** Minimal fixture — same as XLSX test, reused for consistency. */
const fixtureReport: WorksheetReport = {
  orgId: "org-1",
  dateFrom: new Date("2025-01-01"),
  dateTo: new Date("2025-12-31"),
  groups: [
    {
      accountType: "ACTIVO",
      rows: [
        {
          accountId: "caja",
          code: "1.1.1",
          name: "Caja",
          isContraAccount: false,
          accountType: "ACTIVO",
          isCarryOver: false,
          sumasDebe: D("207000"), sumasHaber: D("23152"),
          saldoDeudor: D("183848"), saldoAcreedor: z(),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: D("183848"), saldoAjAcreedor: z(),
          resultadosPerdidas: z(), resultadosGanancias: z(),
          bgActivo: D("183848"), bgPasPat: z(),
        },
        {
          accountId: "depr",
          code: "1.2.6",
          name: "Depreciación Acumulada",
          isContraAccount: true,
          accountType: "ACTIVO",
          isCarryOver: false,
          sumasDebe: z(), sumasHaber: D("120000"),
          saldoDeudor: z(), saldoAcreedor: D("120000"),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: z(), saldoAjAcreedor: D("120000"),
          resultadosPerdidas: z(), resultadosGanancias: z(),
          bgActivo: D("-120000"), bgPasPat: z(),
        },
      ],
      subtotals: {
        ...makeZeroTotals(),
        sumasDebe: D("207000"), sumasHaber: D("143152"),
        saldoDeudor: D("183848"), saldoAcreedor: D("120000"),
        saldoAjDeudor: D("183848"), saldoAjAcreedor: D("120000"),
        bgActivo: D("63848"),
      },
    },
    {
      accountType: "INGRESO",
      rows: [
        {
          accountId: "vtas",
          code: "4.1.1",
          name: "Ventas",
          isContraAccount: false,
          accountType: "INGRESO",
          isCarryOver: false,
          sumasDebe: z(), sumasHaber: D("80000"),
          saldoDeudor: z(), saldoAcreedor: D("80000"),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: z(), saldoAjAcreedor: D("80000"),
          resultadosPerdidas: z(), resultadosGanancias: D("80000"),
          bgActivo: z(), bgPasPat: z(),
        },
      ],
      subtotals: { ...makeZeroTotals(), sumasHaber: D("80000"), saldoAcreedor: D("80000"), saldoAjAcreedor: D("80000"), resultadosGanancias: D("80000") },
    },
    {
      accountType: "GASTO",
      rows: [
        {
          accountId: "costo",
          code: "5.1.1",
          name: "Costo de Ventas",
          isContraAccount: false,
          accountType: "GASTO",
          isCarryOver: false,
          sumasDebe: D("60000"), sumasHaber: z(),
          saldoDeudor: D("60000"), saldoAcreedor: z(),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: D("60000"), saldoAjAcreedor: z(),
          resultadosPerdidas: D("60000"), resultadosGanancias: z(),
          bgActivo: z(), bgPasPat: z(),
        },
      ],
      subtotals: { ...makeZeroTotals(), sumasDebe: D("60000"), saldoDeudor: D("60000"), saldoAjDeudor: D("60000"), resultadosPerdidas: D("60000") },
    },
  ],
  carryOverRow: {
    accountId: "__carry_over__",
    code: "—",
    name: "Ganancia del Ejercicio",
    isContraAccount: false,
    accountType: "INGRESO",
    isCarryOver: true,
    sumasDebe: z(), sumasHaber: z(), saldoDeudor: z(), saldoAcreedor: z(),
    ajustesDebe: z(), ajustesHaber: z(), saldoAjDeudor: z(), saldoAjAcreedor: z(),
    resultadosPerdidas: D("20000"), resultadosGanancias: z(),
    bgActivo: z(), bgPasPat: D("20000"),
  },
  grandTotals: {
    sumasDebe: D("267000"), sumasHaber: D("223152"),
    saldoDeudor: D("243848"), saldoAcreedor: D("200000"),
    ajustesDebe: z(), ajustesHaber: z(),
    saldoAjDeudor: D("243848"), saldoAjAcreedor: D("200000"),
    resultadosPerdidas: D("80000"), resultadosGanancias: D("80000"),
    bgActivo: D("83848"), bgPasPat: D("20000"),
  },
  imbalanced: true,
  imbalanceDelta: D("63848"),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportWorksheetPdf (REQ-12)", () => {
  let buffer: Buffer;
  let docDef: import("pdfmake/interfaces").TDocumentDefinitions;

  it("produces a Buffer (not null/undefined)", async () => {
    const result = await exportWorksheetPdf(fixtureReport, "Test Org");
    buffer = result.buffer;
    docDef = result.docDef;
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("Buffer starts with %PDF (valid PDF header)", () => {
    const header = buffer.toString("ascii", 0, 4);
    expect(header).toBe("%PDF");
  });

  it("Buffer size is within [15KB, 500KB]", () => {
    expect(buffer.length).toBeGreaterThan(15 * 1024);
    expect(buffer.length).toBeLessThan(500 * 1024);
  });

  it("REQ-12: pageSize is A4", () => {
    expect(docDef.pageSize).toBe("A4");
  });

  it("REQ-12: pageOrientation is landscape", () => {
    expect(docDef.pageOrientation).toBe("landscape");
  });

  it("REQ-12: header array has exactly 14 columns", () => {
    // The table header row should have 14 cells: Código + Cuenta + 12 numeric
    // We find it in the doc definition content
    const content = docDef.content as import("pdfmake/interfaces").Content[];
    // Find the table content item
    const tableContent = content.find(
      (c) => typeof c === "object" && c !== null && "table" in c,
    ) as { table: { body: unknown[][] } } | undefined;
    expect(tableContent).toBeDefined();
    const headerRow = tableContent!.table.body[0] as unknown[];
    expect(headerRow).toHaveLength(14);
  });

  it("REQ-12: no pageBreakBefore — single-page layout (no chunking)", () => {
    // The FS portrait PDF uses chunking with pageBreakBefore on second+ sections.
    // The worksheet must NOT do this — single landscape page layout.
    const content = docDef.content as import("pdfmake/interfaces").Content[];
    const hasPageBreak = content.some(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        "pageBreak" in (c as Record<string, unknown>),
    );
    expect(hasPageBreak).toBe(false);
  });
});
