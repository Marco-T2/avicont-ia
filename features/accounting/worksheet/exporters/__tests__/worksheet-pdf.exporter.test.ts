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

// ── fmtDecimal locale tests (es-BO — thousands separator fix) ────────────────

/**
 * These tests drive the fix for the thousands-separator bug found in the T22
 * PDF sample: "207000.00" should render as "207.000,00" (es-BO locale).
 *
 * We access fmtDecimal indirectly by asserting the docDef table body contains
 * the formatted string — which is the only public-facing output we can verify
 * without exporting the private function.
 *
 * We use a helper fixture with a single known value and scan the docDef body.
 */
describe("PDF number formatting — es-BO locale (thousands separator)", () => {
  it("renders 207000 as '207.000,00' (not '207000.00') in docDef body", async () => {
    const singleRowReport: WorksheetReport = {
      orgId: "org-fmt",
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
      groups: [
        {
          accountType: "ACTIVO",
          rows: [
            {
              accountId: "caja2",
              code: "1.1.1",
              name: "Caja",
              isContraAccount: false,
              accountType: "ACTIVO",
              isCarryOver: false,
              sumasDebe: D("207000"), sumasHaber: z(),
              saldoDeudor: D("207000"), saldoAcreedor: z(),
              ajustesDebe: z(), ajustesHaber: z(),
              saldoAjDeudor: D("207000"), saldoAjAcreedor: z(),
              resultadosPerdidas: z(), resultadosGanancias: z(),
              bgActivo: D("207000"), bgPasPat: z(),
            },
          ],
          subtotals: {
            ...makeZeroTotals(),
            sumasDebe: D("207000"), saldoDeudor: D("207000"),
            saldoAjDeudor: D("207000"), bgActivo: D("207000"),
          },
        },
      ],
      carryOverRow: undefined,
      grandTotals: {
        ...makeZeroTotals(),
        sumasDebe: D("207000"), saldoDeudor: D("207000"),
        saldoAjDeudor: D("207000"), bgActivo: D("207000"),
      },
      imbalanced: false,
      imbalanceDelta: D(0),
    };

    const { docDef } = await exportWorksheetPdf(singleRowReport, "Test Fmt Org");

    // Collect all text values from the table body
    type PdfContent = { text?: string; table?: { body: PdfContent[][] } };
    const content = docDef.content as PdfContent[];
    const tableItem = content.find((c) => c && "table" in c) as { table: { body: PdfContent[][] } } | undefined;
    expect(tableItem).toBeDefined();

    const allTexts: string[] = [];
    for (const row of tableItem!.table.body) {
      for (const cell of row) {
        if (cell && typeof cell.text === "string" && cell.text.length > 0) {
          allTexts.push(cell.text);
        }
      }
    }

    // Must contain es-BO formatted value (period thousands, comma decimal)
    expect(allTexts, "expected es-BO formatted '207.000,00'").toContain("207.000,00");
    // Must NOT contain raw unformatted value
    expect(allTexts, "must NOT contain raw '207000.00'").not.toContain("207000.00");
  });

  it("renders contra-account −120000 as '(120.000,00)' with es-BO locale", async () => {
    const contraReport: WorksheetReport = {
      orgId: "org-contra-fmt",
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
      groups: [
        {
          accountType: "ACTIVO",
          rows: [
            {
              accountId: "depr2",
              code: "1.2.6",
              name: "Depreciación",
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
            sumasHaber: D("120000"), saldoAcreedor: D("120000"),
            saldoAjAcreedor: D("120000"), bgActivo: D("-120000"),
          },
        },
      ],
      carryOverRow: undefined,
      grandTotals: {
        ...makeZeroTotals(),
        sumasHaber: D("120000"), saldoAcreedor: D("120000"),
        saldoAjAcreedor: D("120000"), bgActivo: D("-120000"),
      },
      imbalanced: false,
      imbalanceDelta: D(0),
    };

    const { docDef } = await exportWorksheetPdf(contraReport, "Test Contra Org");

    type PdfContent = { text?: string; table?: { body: PdfContent[][] } };
    const content = docDef.content as PdfContent[];
    const tableItem = content.find((c) => c && "table" in c) as { table: { body: PdfContent[][] } } | undefined;
    expect(tableItem).toBeDefined();

    const allTexts: string[] = [];
    for (const row of tableItem!.table.body) {
      for (const cell of row) {
        if (cell && typeof cell.text === "string" && cell.text.length > 0) {
          allTexts.push(cell.text);
        }
      }
    }

    // Must contain es-BO formatted contra value in parens
    expect(allTexts, "expected es-BO contra '(120.000,00)'").toContain("(120.000,00)");
    // Must NOT contain raw unformatted value
    expect(allTexts, "must NOT contain raw '(120000.00)'").not.toContain("(120000.00)");
  });
});

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
