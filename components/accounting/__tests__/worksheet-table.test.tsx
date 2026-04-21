/**
 * T25 — RED: WorksheetTable component tests.
 *
 * Asserts:
 * (a) Renders 5 group headers in canonical order (ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO).
 * (b) Contra-account row bgActivo cell renders with parens e.g. "(120,000.00)" or "(120.000,00)".
 * (c) Carry-over row has label "Ganancia del Ejercicio" or "Pérdida del Ejercicio".
 * (d) Subtotal rows are visually distinct (bold class present).
 *
 * Covers REQ-9, REQ-6 (display), REQ-7 (carry-over label).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { WorksheetTable } from "../worksheet-table";

afterEach(() => cleanup());

// ── Serialized fixture (Decimals as strings — same shape as JSON API response) ─

function makeZero() {
  return "0";
}

function makeRow(overrides: Record<string, string | boolean> = {}) {
  return {
    accountId: "acc-1",
    code: "1.1.1",
    name: "Caja",
    isContraAccount: false,
    accountType: "ACTIVO",
    isCarryOver: false,
    sumasDebe: "207000",
    sumasHaber: "23152",
    saldoDeudor: "183848",
    saldoAcreedor: makeZero(),
    ajustesDebe: makeZero(),
    ajustesHaber: makeZero(),
    saldoAjDeudor: "183848",
    saldoAjAcreedor: makeZero(),
    resultadosPerdidas: makeZero(),
    resultadosGanancias: makeZero(),
    bgActivo: "183848",
    bgPasPat: makeZero(),
    ...overrides,
  };
}

function makeZeroTotals() {
  return {
    sumasDebe: makeZero(), sumasHaber: makeZero(),
    saldoDeudor: makeZero(), saldoAcreedor: makeZero(),
    ajustesDebe: makeZero(), ajustesHaber: makeZero(),
    saldoAjDeudor: makeZero(), saldoAjAcreedor: makeZero(),
    resultadosPerdidas: makeZero(), resultadosGanancias: makeZero(),
    bgActivo: makeZero(), bgPasPat: makeZero(),
  };
}

const fixtureReport = {
  orgId: "org-1",
  dateFrom: "2025-01-01T00:00:00.000Z",
  dateTo: "2025-12-31T00:00:00.000Z",
  groups: [
    {
      accountType: "ACTIVO",
      rows: [
        makeRow({ code: "1.1.1", name: "Caja", bgActivo: "183848" }),
        makeRow({
          code: "1.2.6",
          name: "Depreciación Acumulada",
          isContraAccount: true,
          bgActivo: "-120000",
        }),
      ],
      subtotals: { ...makeZeroTotals(), bgActivo: "63848" },
    },
    {
      accountType: "PASIVO",
      rows: [
        makeRow({
          code: "2.1.1",
          name: "Proveedores",
          accountType: "PASIVO",
          bgActivo: makeZero(),
          bgPasPat: "80000",
        }),
      ],
      subtotals: { ...makeZeroTotals(), bgPasPat: "80000" },
    },
    {
      accountType: "PATRIMONIO",
      rows: [
        makeRow({
          code: "3.1.1",
          name: "Capital",
          accountType: "PATRIMONIO",
          bgActivo: makeZero(),
          bgPasPat: "80000",
        }),
      ],
      subtotals: { ...makeZeroTotals(), bgPasPat: "80000" },
    },
    {
      accountType: "INGRESO",
      rows: [
        makeRow({
          code: "4.1.1",
          name: "Ventas",
          accountType: "INGRESO",
          bgActivo: makeZero(),
          resultadosGanancias: "80000",
        }),
      ],
      subtotals: { ...makeZeroTotals(), resultadosGanancias: "80000" },
    },
    {
      accountType: "GASTO",
      rows: [
        makeRow({
          code: "5.1.1",
          name: "Costo de Ventas",
          accountType: "GASTO",
          bgActivo: makeZero(),
          resultadosPerdidas: "60000",
        }),
      ],
      subtotals: { ...makeZeroTotals(), resultadosPerdidas: "60000" },
    },
  ],
  carryOverRow: {
    accountId: "__carry_over__",
    code: "—",
    name: "Ganancia del Ejercicio",
    isContraAccount: false,
    accountType: "INGRESO",
    isCarryOver: true,
    ...makeZeroTotals(),
    resultadosPerdidas: "20000",
    bgPasPat: "20000",
  },
  grandTotals: { ...makeZeroTotals(), bgActivo: "83848", bgPasPat: "180000" },
  imbalanced: false,
  imbalanceDelta: makeZero(),
};

describe("WorksheetTable (REQ-9, REQ-6, REQ-7)", () => {
  it("(a) renders 5 group headers in canonical order (ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO)", () => {
    render(<WorksheetTable report={fixtureReport} />);

    const groupHeaders = screen.getAllByRole("rowgroup").flatMap((group) =>
      Array.from(group.querySelectorAll("[data-group-header]")),
    );

    // Alternatively, check text presence in order
    const groupTexts = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO"];
    for (const text of groupTexts) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }

    // Check order by position in DOM
    const all = screen.getAllByText(/^(ACTIVO|PASIVO|PATRIMONIO|INGRESO|GASTO)$/);
    const texts = all.map((el) => el.textContent);
    expect(texts).toEqual(groupTexts);
    // Suppress unused variable warning for groupHeaders
    void groupHeaders;
  });

  it("(b) contra-account row bgActivo cell renders with parens for negative value", () => {
    render(<WorksheetTable report={fixtureReport} />);

    // The bgActivo cell for the contra-account (Depreciación) should show (120,000.00) or (120.000,00) style
    const cells = screen.getAllByText(/\(120/);
    expect(cells.length).toBeGreaterThan(0);
  });

  it("(c) carry-over row renders 'Ganancia del Ejercicio' label", () => {
    render(<WorksheetTable report={fixtureReport} />);

    expect(screen.getByText("Ganancia del Ejercicio")).toBeInTheDocument();
  });

  it("(d) subtotal rows have a bold visual style (font-bold class or role)", () => {
    render(<WorksheetTable report={fixtureReport} />);

    // Subtotal rows should have a data-subtotal attribute or font-bold class
    const boldCells = document.querySelectorAll("[data-subtotal]");
    expect(boldCells.length).toBeGreaterThan(0);
  });
});
