/**
 * B8 — RED: TrialBalanceTable component tests.
 *
 * Asserts:
 * (a) Renders 7 column headers (N°, Código, Cuenta, Sumas Debe, Sumas Haber, Saldo Deudor, Saldo Acreedor).
 * (b) Renders a data row for each account in report.rows.
 * (c) Renders TOTAL row at bottom.
 * (d) Imbalance banner shown when report.imbalanced=true.
 * (e) No imbalance banner when report.imbalanced=false.
 *
 * Covers C3.S1 (7-column flat list), C5.S6 (imbalance).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { TrialBalanceTable } from "../trial-balance-table";

afterEach(() => cleanup());

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeZero() { return "0.00"; }

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-1",
    dateFrom: "2025-01-01T00:00:00.000Z",
    dateTo: "2025-12-31T00:00:00.000Z",
    rows: [
      {
        accountId: "acc-1",
        code: "1.1.1",
        name: "Caja",
        sumasDebe: "1234567.89",
        sumasHaber: makeZero(),
        saldoDeudor: "1234567.89",
        saldoAcreedor: makeZero(),
      },
      {
        accountId: "acc-2",
        code: "2.1.1",
        name: "Proveedores",
        sumasDebe: makeZero(),
        sumasHaber: "500.00",
        saldoDeudor: makeZero(),
        saldoAcreedor: "500.00",
      },
    ],
    totals: {
      sumasDebe: "1234567.89",
      sumasHaber: "500.00",
      saldoDeudor: "1234567.89",
      saldoAcreedor: "500.00",
    },
    imbalanced: false,
    deltaSumas: makeZero(),
    deltaSaldos: makeZero(),
    oppositeSignAccounts: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialBalanceTable (C3.S1)", () => {
  it("(a) renders 7 column headers", () => {
    render(<TrialBalanceTable report={makeReport()} />);
    expect(screen.getByText("N°")).toBeInTheDocument();
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Cuenta")).toBeInTheDocument();
    expect(screen.getByText("Sumas Debe")).toBeInTheDocument();
    expect(screen.getByText("Sumas Haber")).toBeInTheDocument();
    expect(screen.getByText("Saldo Deudor")).toBeInTheDocument();
    expect(screen.getByText("Saldo Acreedor")).toBeInTheDocument();
  });

  it("(b) renders one row per account in report.rows", () => {
    render(<TrialBalanceTable report={makeReport()} />);
    expect(screen.getByText("Caja")).toBeInTheDocument();
    expect(screen.getByText("Proveedores")).toBeInTheDocument();
    expect(screen.getByText("1.1.1")).toBeInTheDocument();
    expect(screen.getByText("2.1.1")).toBeInTheDocument();
  });

  it("(c) renders TOTAL row", () => {
    render(<TrialBalanceTable report={makeReport()} />);
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
  });

  it("(d) shows imbalance banner when report.imbalanced=true", () => {
    render(<TrialBalanceTable report={makeReport({ imbalanced: true })} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("(e) no imbalance banner when report.imbalanced=false", () => {
    render(<TrialBalanceTable report={makeReport({ imbalanced: false })} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
