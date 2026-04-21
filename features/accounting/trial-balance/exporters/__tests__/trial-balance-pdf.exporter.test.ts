/**
 * B6 — RED: PDF exporter tests.
 *
 * Covers: C6.S1-S6, C6.E1, C8.S1-S4
 * All tests use docDef inspection — not parsing the full PDF binary.
 * Buffer signature (%PDF) is checked via the raw buffer.
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  exportTrialBalancePdf,
  MissingOrgNameError,
} from "../trial-balance-pdf.exporter";
import type { TrialBalanceReport } from "../../trial-balance.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

function makeReport(overrides?: Partial<TrialBalanceReport>): TrialBalanceReport {
  return {
    orgId: "org-1",
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
    rows: [
      {
        accountId: "acc-1",
        code: "1.1.1",
        name: "Caja",
        sumasDebe: D("1234567.89"),
        sumasHaber: D("0"),
        saldoDeudor: D("1234567.89"),
        saldoAcreedor: D("0"),
      },
      {
        accountId: "acc-2",
        code: "2.1.1",
        name: "Proveedores",
        sumasDebe: D("0"),
        sumasHaber: D("500"),
        saldoDeudor: D("0"),
        saldoAcreedor: D("500"),
      },
    ],
    totals: {
      sumasDebe: D("1234567.89"),
      sumasHaber: D("500"),
      saldoDeudor: D("1234567.89"),
      saldoAcreedor: D("500"),
    },
    imbalanced: false,
    deltaSumas: D("0"),
    deltaSaldos: D("0"),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportTrialBalancePdf — page layout (C6.S1)", () => {
  it("C6.S1 — docDef pageOrientation is 'portrait' and pageSize is 'A4'", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    expect(docDef.pageOrientation).toBe("portrait");
    expect(docDef.pageSize).toBe("A4");
  });
});

describe("exportTrialBalancePdf — column count (C6.S2)", () => {
  it("C6.S2 — data row has exactly 7 cells", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    // Find the table in content
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table);
    expect(tableBlock).toBeDefined();
    const body = tableBlock!.table!.body;
    // Row index 1 is the first data row (index 0 is header)
    const dataRow = body[1] as unknown[];
    expect(dataRow).toHaveLength(7);
  });
});

describe("exportTrialBalancePdf — es-BO formatting (C6.S3, C6.S4)", () => {
  it("C6.S3 — sumasDebe=1234567.89 → cell text '1.234.567,89'", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column index 3 = Sumas Debe (0-indexed: N°=0, Código=1, Cuenta=2, SumasDebe=3)
    const sumasDebeCell = dataRow[3];
    expect(sumasDebeCell.text).toBe("1.234.567,89");
  });

  it("C6.S4 — fmtDecimal(-1234.56) → '(1.234,56)'", async () => {
    // Use a report with a negative total to test the formatter
    const reportWithNeg = makeReport({
      totals: {
        sumasDebe: D("-1234.56"),
        sumasHaber: D("0"),
        saldoDeudor: D("0"),
        saldoAcreedor: D("0"),
      },
    });
    const { docDef } = await exportTrialBalancePdf(reportWithNeg, "Avicont SA");
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    // Last row = TOTAL row
    const body = tableBlock.table!.body;
    const totalRow = body[body.length - 1] as Array<{ text: string }>;
    // Column 3 = Sumas Debe total
    const totalSumasDebeCell = totalRow[3];
    expect(totalSumasDebeCell.text).toBe("(1.234,56)");
  });
});

describe("exportTrialBalancePdf — TOTAL row (C6.S5)", () => {
  it("C6.S5 — last body row is TOTAL row and cells are bold", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const body = tableBlock.table!.body;
    const lastRow = body[body.length - 1] as Array<{ bold: boolean; text?: string }>;
    // All cells in the last row should be bold
    for (const cell of lastRow) {
      expect(cell.bold).toBe(true);
    }
  });
});

describe("exportTrialBalancePdf — imbalance banner (C6.S6)", () => {
  it("C6.S6 — report.imbalanced=true → imbalance banner in content with delta values", async () => {
    const imbalancedReport = makeReport({
      imbalanced: true,
      deltaSumas: D("-50"),
      deltaSaldos: D("10"),
    });
    const { docDef } = await exportTrialBalancePdf(imbalancedReport, "Avicont SA");
    const content = docDef.content as Array<{ text?: string; color?: string }>;
    const banner = content.find((c) => c.color === "#b91c1c");
    expect(banner).toBeDefined();
    expect(banner!.text).toContain("(50,00)"); // delta -50 formatted as (50,00)
  });

  it("report.imbalanced=false → NO imbalance banner", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    const content = docDef.content as Array<{ color?: string }>;
    const banner = content.find((c) => c.color === "#b91c1c");
    expect(banner).toBeUndefined();
  });
});

describe("exportTrialBalancePdf — edge cases (C6.E1)", () => {
  it("C6.E1 — empty rows → buffer produced (no crash), header + TOTAL row present", async () => {
    const emptyReport = makeReport({
      rows: [],
      totals: {
        sumasDebe: D("0"),
        sumasHaber: D("0"),
        saldoDeudor: D("0"),
        saldoAcreedor: D("0"),
      },
    });
    const { buffer, docDef } = await exportTrialBalancePdf(emptyReport, "Avicont SA");
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    // docDef should still have a table with header + total
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    // body[0] = header row, body[1] = total row (no data rows)
    expect(tableBlock.table!.body).toHaveLength(2); // header + total
  });
});

describe("exportTrialBalancePdf — header metadata (C8)", () => {
  it("C8.S1 — all fields present → header contains org name and NIT", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA", "1001", "Av. Principal 123");
    const content = docDef.content as Array<{ text?: string }>;
    const empresaLine = content.find((c) => typeof c.text === "string" && c.text.includes("Avicont SA"));
    expect(empresaLine).toBeDefined();
    const nitLine = content.find((c) => typeof c.text === "string" && c.text.includes("NIT: 1001"));
    expect(nitLine).toBeDefined();
  });

  it("C8.S2 — taxId=null → NIT segment absent", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA", undefined, "Av. Principal 123");
    const content = docDef.content as Array<{ text?: string }>;
    const nitLine = content.find((c) => typeof c.text === "string" && c.text.includes("NIT:"));
    expect(nitLine).toBeUndefined();
    // But address should be present
    const addrLine = content.find((c) => typeof c.text === "string" && c.text.includes("Av. Principal 123"));
    expect(addrLine).toBeDefined();
  });

  it("C8.S4 — both taxId and address null → line 2 omitted entirely", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    const content = docDef.content as Array<{ text?: string }>;
    // No line containing "NIT:" or "Dirección:"
    const line2 = content.find(
      (c) => typeof c.text === "string" && (c.text.includes("NIT:") || c.text.includes("Dirección:")),
    );
    expect(line2).toBeUndefined();
  });
});

describe("exportTrialBalancePdf — column widths", () => {
  it("column widths sum to 535pt", async () => {
    const { docDef } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    const content = docDef.content as Array<Record<string, unknown>>;
    const tableBlock = content.find((c) => c.table)!;
    // pdfmake mutates widths entries into objects with a `width` property; plain numbers also accepted
    const table = tableBlock.table as { widths: Array<number | { width: number }> };
    const sum = table.widths.reduce((acc, w) => acc + (typeof w === "number" ? w : w.width), 0);
    expect(sum).toBe(535);
  });
});

describe("exportTrialBalancePdf — buffer signature", () => {
  it("buffer starts with %PDF (C11 / B11.5)", async () => {
    const { buffer } = await exportTrialBalancePdf(makeReport(), "Avicont SA");
    const magic = buffer.subarray(0, 4).toString("ascii");
    expect(magic).toBe("%PDF");
  });
});

describe("exportTrialBalancePdf — MissingOrgNameError (C8.E1)", () => {
  it("C8.E1 — orgName is empty → throws MissingOrgNameError", async () => {
    await expect(exportTrialBalancePdf(makeReport(), "")).rejects.toThrow(MissingOrgNameError);
  });
});
