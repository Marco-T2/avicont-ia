/**
 * POC date-calendar-vs-instant-convention C4 RED — 10 parametrized exporter
 * T00-date label drift cases.
 *
 * Hypothesis: with `TZ=America/La_Paz` set in vitest.config (P0.21), feeding
 * a calendar-day Date at UTC midnight ("2026-04-30T00:00:00.000Z") to any
 * exporter's local `fmtDate` helper that calls `toLocaleDateString("es-BO", ...)`
 * (with OR without `timeZone:"America/La_Paz"` — both drift D-1 because Bolivia
 * is UTC-4) renders "29/04/2026" instead of the expected "30/04/2026".
 *
 * Fix path (G9): replace each exporter's local `fmtDate(d)` with
 * `formatDateBO(d)` from `lib/date-utils` — pure ISO-slice, TZ-safe by
 * construction. Sister precedent #2233 Bug B sweep (6 non-accounting
 * components already migrated).
 *
 * Failure mode declared (pre-GREEN, per [[red_acceptance_failure_mode]]):
 *   Each case: `expect(rendered).toContain("30/04/2026")` → receives output
 *   that contains "29/04/2026" → MISMATCH. No throws.
 *
 * Per Step 0 audit #2600: 6 exporters use `timeZone:"America/La_Paz"` (not
 * "bare no TZ" as design draft assumed) — they STILL drift D-1 for T00 inputs
 * because UTC midnight in BO local is 20:00 the prior day. Fix is identical.
 *
 * 10 cases:
 *   SC-16: trial-balance-pdf (period label "DEL ... AL ...")
 *   SC-17: trial-balance-xlsx (cell row 4 period text)
 *   SC-18: equity-statement-pdf (period label)
 *   SC-19: equity-statement-xlsx (period cell)
 *   SC-20: worksheet-pdf (period label)
 *   SC-21: worksheet-xlsx (period cell)
 *   SC-22: initial-balance-pdf (date label "fmtDateLong")
 *   SC-23: initial-balance-xlsx (date cell)
 *   SC-24: trial-balance-pdf with same dateFrom=dateTo edge case
 *   SC-25: equity-statement-pdf with multi-day window (dateFrom + dateTo)
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";

// PDF exporters
import { exportTrialBalancePdf } from "../trial-balance/infrastructure/exporters/trial-balance-pdf.exporter";
import { exportEquityStatementPdf } from "../equity-statement/infrastructure/exporters/equity-statement-pdf.exporter";
import { exportWorksheetPdf } from "../worksheet/infrastructure/exporters/worksheet-pdf.exporter";
import { exportInitialBalancePdf } from "../initial-balance/infrastructure/exporters/initial-balance-pdf.exporter";

// XLSX exporters
import { exportTrialBalanceXlsx } from "../trial-balance/infrastructure/exporters/trial-balance-xlsx.exporter";
import { exportEquityStatementXlsx } from "../equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter";
import { exportWorksheetXlsx } from "../worksheet/infrastructure/exporters/worksheet-xlsx.exporter";
import { exportInitialBalanceXlsx } from "../initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter";

// Initial balance builder
import { buildInitialBalance } from "../initial-balance/domain/initial-balance.builder";

import type { TrialBalanceReport } from "../trial-balance/domain/trial-balance.types";
import type { EquityStatement } from "../equity-statement/domain/equity-statement.types";
import type { WorksheetReport } from "../worksheet/domain/worksheet.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const T00 = new Date("2026-04-30T00:00:00.000Z");
const T00_START = new Date("2026-04-01T00:00:00.000Z");
const EXPECTED_LABEL = "30/04/2026";
const EXPECTED_START_LABEL = "01/04/2026";

// ── Fixtures (minimal) ─────────────────────────────────────────────────────

function makeTrialBalance(dateFrom: Date, dateTo: Date): TrialBalanceReport {
  return {
    orgId: "org-1",
    dateFrom,
    dateTo,
    rows: [
      {
        accountId: "acc-1",
        code: "1.1.1",
        name: "Caja",
        sumasDebe: D("100"),
        sumasHaber: D("0"),
        saldoDeudor: D("100"),
        saldoAcreedor: D("0"),
      },
    ],
    totals: {
      sumasDebe: D("100"),
      sumasHaber: D("0"),
      saldoDeudor: D("100"),
      saldoAcreedor: D("0"),
    },
    imbalanced: false,
    deltaSumas: D("0"),
    deltaSaldos: D("0"),
  };
}

function makeEquityStatement(dateFrom: Date, dateTo: Date): EquityStatement {
  const ZERO = D("0");
  return {
    orgId: "org-1",
    dateFrom,
    dateTo,
    columns: [
      { key: "CAPITAL_SOCIAL", label: "Capital Social", visible: true },
      { key: "APORTES_CAPITALIZAR", label: "Aportes", visible: false },
      { key: "AJUSTE_CAPITAL", label: "Ajuste", visible: false },
      { key: "RESERVA_LEGAL", label: "Reserva", visible: false },
      { key: "RESULTADOS_ACUMULADOS", label: "Resultados", visible: false },
      { key: "OTROS_PATRIMONIO", label: "Otros", visible: false },
    ],
    rows: [
      {
        key: "SALDO_INICIAL",
        label: "Saldo al inicio",
        cells: [
          { column: "CAPITAL_SOCIAL", amount: D("5000") },
          { column: "APORTES_CAPITALIZAR", amount: ZERO },
          { column: "AJUSTE_CAPITAL", amount: ZERO },
          { column: "RESERVA_LEGAL", amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: ZERO },
          { column: "OTROS_PATRIMONIO", amount: ZERO },
        ],
        total: D("5000"),
      },
      {
        key: "SALDO_FINAL",
        label: "Saldo al cierre",
        cells: [
          { column: "CAPITAL_SOCIAL", amount: D("5000") },
          { column: "APORTES_CAPITALIZAR", amount: ZERO },
          { column: "AJUSTE_CAPITAL", amount: ZERO },
          { column: "RESERVA_LEGAL", amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: ZERO },
          { column: "OTROS_PATRIMONIO", amount: ZERO },
        ],
        total: D("5000"),
      },
    ],
    columnTotals: {
      CAPITAL_SOCIAL: D("5000"),
      APORTES_CAPITALIZAR: ZERO,
      AJUSTE_CAPITAL: ZERO,
      RESERVA_LEGAL: ZERO,
      RESULTADOS_ACUMULADOS: ZERO,
      OTROS_PATRIMONIO: ZERO,
    },
    grandTotal: D("5000"),
    periodResult: ZERO,
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
  };
}

function makeZeroWorksheetTotals() {
  const z = D("0");
  return {
    sumasDebe: z,
    sumasHaber: z,
    saldoDeudor: z,
    saldoAcreedor: z,
    ajustesDebe: z,
    ajustesHaber: z,
    saldoAjDeudor: z,
    saldoAjAcreedor: z,
    resultadosPerdidas: z,
    resultadosGanancias: z,
    bgActivo: z,
    bgPasPat: z,
  };
}

function makeWorksheetReport(dateFrom: Date, dateTo: Date): WorksheetReport {
  const z = D("0");
  return {
    orgId: "org-1",
    dateFrom,
    dateTo,
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
            sumasDebe: D("100"),
            sumasHaber: z,
            saldoDeudor: D("100"),
            saldoAcreedor: z,
            ajustesDebe: z,
            ajustesHaber: z,
            saldoAjDeudor: D("100"),
            saldoAjAcreedor: z,
            resultadosPerdidas: z,
            resultadosGanancias: z,
            bgActivo: D("100"),
            bgPasPat: z,
          },
        ],
        subtotals: {
          ...makeZeroWorksheetTotals(),
          sumasDebe: D("100"),
          saldoDeudor: D("100"),
          saldoAjDeudor: D("100"),
          bgActivo: D("100"),
        },
      },
    ],
    carryOverRow: undefined,
    grandTotals: {
      ...makeZeroWorksheetTotals(),
      sumasDebe: D("100"),
      saldoDeudor: D("100"),
      saldoAjDeudor: D("100"),
      bgActivo: D("100"),
    },
    imbalanced: false,
    imbalanceDelta: z,
  };
}

function makeInitialBalance(dateAt: Date) {
  return buildInitialBalance({
    orgId: "org-1",
    org: {
      razonSocial: "Test Coop",
      nit: "999",
      representanteLegal: "Test",
      direccion: "Av Test",
      ciudad: "La Paz",
    },
    dateAt,
    rows: [
      {
        accountId: "acc-1",
        code: "1100",
        name: "Caja",
        subtype: "ACTIVO_CORRIENTE",
        amount: D("100"),
      },
      {
        accountId: "acc-2",
        code: "3100",
        name: "Capital",
        subtype: "PATRIMONIO_CAPITAL",
        amount: D("100"),
      },
    ],
    caCount: 1,
  });
}

async function parseWorkbook(buffer: Buffer | Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

function workbookText(wb: ExcelJS.Workbook): string {
  const parts: string[] = [];
  wb.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v === "string") parts.push(v);
        else if (v && typeof v === "object" && "richText" in v) {
          const rt = (v as { richText: Array<{ text: string }> }).richText;
          parts.push(rt.map((r) => r.text).join(""));
        }
      });
    });
  });
  return parts.join(" | ");
}

describe("POC date-calendar-vs-instant-convention C4 — 10 parametrized exporter T00-date label drift cases (8 exporters; replace local fmtDate toLocaleDateString → formatDateBO at G9, sister precedent #2233 Bug B EXACT mirror per [[paired_sister_default_no_surface]]; per Step 0 audit #2600 La Paz TZ also drifts D-1 on T00 inputs — fix path identical)", () => {
  it("SC-16: trial-balance-pdf renders dateTo T00 as '30/04/2026' (current: '29/04/2026' MISMATCH)", async () => {
    const result = await exportTrialBalancePdf(
      makeTrialBalance(T00_START, T00),
      "Test",
    );
    const json = JSON.stringify(result.docDef);
    expect(json).toContain(EXPECTED_LABEL);
  });

  it("SC-17: trial-balance-xlsx renders dateTo T00 as '30/04/2026' in period cell (current: '29/04/2026' MISMATCH)", async () => {
    const buffer = await exportTrialBalanceXlsx(
      makeTrialBalance(T00_START, T00),
      "Test",
    );
    const wb = await parseWorkbook(buffer);
    expect(workbookText(wb)).toContain(EXPECTED_LABEL);
  });

  it("SC-18: equity-statement-pdf renders dateTo T00 as '30/04/2026' (current: '29/04/2026' MISMATCH)", async () => {
    const result = await exportEquityStatementPdf(
      makeEquityStatement(T00_START, T00),
      "Test",
    );
    const json = JSON.stringify(result.docDef);
    expect(json).toContain(EXPECTED_LABEL);
  });

  it("SC-19: equity-statement-xlsx renders dateTo T00 as '30/04/2026' in period cell (current: '29/04/2026' MISMATCH)", async () => {
    const buffer = await exportEquityStatementXlsx(
      makeEquityStatement(T00_START, T00),
      "Test",
    );
    const wb = await parseWorkbook(buffer);
    expect(workbookText(wb)).toContain(EXPECTED_LABEL);
  });

  it("SC-20: worksheet-pdf renders dateTo T00 as '30/04/2026' (current: '29/04/2026' MISMATCH)", async () => {
    const result = await exportWorksheetPdf(
      makeWorksheetReport(T00_START, T00),
      "Test",
    );
    const json = JSON.stringify(result.docDef);
    expect(json).toContain(EXPECTED_LABEL);
  });

  it("SC-21: worksheet-xlsx renders dateTo T00 as '30/04/2026' in period cell (current: '29/04/2026' MISMATCH)", async () => {
    const buffer = await exportWorksheetXlsx(
      makeWorksheetReport(T00_START, T00),
      "Test",
    );
    const wb = await parseWorkbook(buffer);
    expect(workbookText(wb)).toContain(EXPECTED_LABEL);
  });

  it("SC-22: initial-balance-pdf renders dateAt T00 as '30/04/2026' (current: '29/04/2026' MISMATCH; uses fmtDateLong → still drifts D-1 on T00 in BO TZ)", async () => {
    const result = await exportInitialBalancePdf(makeInitialBalance(T00));
    const json = JSON.stringify(result.docDef);
    // Initial-balance uses long format "30 de abril de 2026" — strip to day check
    // Note: fmtDateLong uses month:"long" so the raw "30/04/2026" string won't
    // appear; instead assert calendar day "30" + "abril" + "2026" all present
    // for the T00-drift case (current would render "29 de abril de 2026").
    const hasDay30 = /\b30 de abril de 2026\b/.test(json);
    expect(hasDay30).toBe(true);
  });

  it("SC-23: initial-balance-xlsx renders dateAt T00 as '30/04/2026' or '30 de abril de 2026' in cells (current drifts to D-1 MISMATCH)", async () => {
    const buffer = await exportInitialBalanceXlsx(makeInitialBalance(T00));
    const wb = await parseWorkbook(buffer);
    const text = workbookText(wb);
    // initial-balance-xlsx may use long or short format; accept either D-correct shape
    const hasDay30 =
      text.includes(EXPECTED_LABEL) || /\b30 de abril de 2026\b/.test(text);
    expect(hasDay30).toBe(true);
  });

  it("SC-24: trial-balance-pdf same-day window (dateFrom = dateTo = T00) renders '30/04/2026' for both endpoints (edge case)", async () => {
    const result = await exportTrialBalancePdf(
      makeTrialBalance(T00, T00),
      "Test",
    );
    const json = JSON.stringify(result.docDef);
    // The period label is "DEL <fmtDate> AL <fmtDate>" — both should be "30/04/2026"
    const occurrences = (json.match(/30\/04\/2026/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("SC-25: equity-statement-pdf multi-day window — dateFrom T00 = '01/04/2026' AND dateTo T00 = '30/04/2026' both present (both drift D-1 in current)", async () => {
    const result = await exportEquityStatementPdf(
      makeEquityStatement(T00_START, T00),
      "Test",
    );
    const json = JSON.stringify(result.docDef);
    expect(json).toContain(EXPECTED_START_LABEL);
    expect(json).toContain(EXPECTED_LABEL);
  });
});
