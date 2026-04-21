/**
 * T20 — RED: InitialBalanceView component tests.
 *
 * Asserts:
 * (a) Renders two sections (ACTIVO and PASIVO Y PATRIMONIO) using StatementLineRow,
 *     with the correct structural hierarchy (header → header → account → subtotal → total).
 * (b) Shows imbalance alert banner when `imbalanced: true`.
 * (c) Shows multipleCA warning banner when `multipleCA: true`.
 * (d) Amount formatting via formatBOB (es-BO locale with "Bs." prefix):
 *     - positive 1234.56 → "Bs. 1.234,56"
 *     - negative -1234.56 → "Bs. -1.234,56" (formatBOB uses es-BO minus sign, not parens)
 *     - zero in a detail row → row is NOT rendered at all
 *     - zero in a total/subtotal → rendered as "Bs. 0,00"
 * (e) Detail rows with amount 0 are skipped entirely (not rendered).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

// ── Import after afterEach so cleanup runs before next suite ──────────────────
import { InitialBalanceView } from "../initial-balance-view";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVO_GROUP = {
  subtype: "ACTIVO_CORRIENTE",
  label: "Activo Corriente",
  rows: [
    { accountId: "acc-1", code: "1.1.01", name: "Caja", amount: "1234.56" },
    { accountId: "acc-2", code: "1.1.02", name: "Banco", amount: "0" },      // zero → skipped
    { accountId: "acc-3", code: "1.1.03", name: "Deudas", amount: "-1234.56" },
  ],
  subtotal: "0.00",
};

const PASIVO_GROUP = {
  subtype: "PASIVO_CORRIENTE",
  label: "Pasivo Corriente",
  rows: [
    { accountId: "acc-4", code: "2.1.01", name: "Proveedores", amount: "5000.00" },
  ],
  subtotal: "5000.00",
};

const PATRIMONIO_GROUP = {
  subtype: "PATRIMONIO_CAPITAL",
  label: "Capital Social",
  rows: [
    { accountId: "acc-5", code: "3.1.01", name: "Capital", amount: "0" },   // zero → skipped
  ],
  subtotal: "0.00",
};

function makeStatement(overrides?: Record<string, unknown>) {
  return {
    orgId: "org-1",
    dateAt: "2025-01-01T00:00:00.000Z",
    sections: [
      {
        key: "ACTIVO",
        label: "ACTIVO",
        groups: [ACTIVO_GROUP],
        sectionTotal: "0.00",
      },
      {
        key: "PASIVO_PATRIMONIO",
        label: "PASIVO Y PATRIMONIO",
        groups: [PASIVO_GROUP, PATRIMONIO_GROUP],
        sectionTotal: "5000.00",
      },
    ],
    imbalanced: false,
    imbalanceDelta: "0",
    multipleCA: false,
    caCount: 1,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InitialBalanceView", () => {
  it("(a) renders two section headings and group labels", () => {
    render(<InitialBalanceView statement={makeStatement()} />);

    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    expect(screen.getByText("PASIVO Y PATRIMONIO")).toBeInTheDocument();

    // Group labels
    expect(screen.getByText("Activo Corriente")).toBeInTheDocument();
    expect(screen.getByText("Pasivo Corriente")).toBeInTheDocument();
    expect(screen.getByText("Capital Social")).toBeInTheDocument();

    // Account names (non-zero rows)
    expect(screen.getByText("Caja")).toBeInTheDocument();
    expect(screen.getByText("Deudas")).toBeInTheDocument();
    expect(screen.getByText("Proveedores")).toBeInTheDocument();
  });

  it("(b) shows imbalance alert banner when imbalanced: true", () => {
    render(<InitialBalanceView statement={makeStatement({ imbalanced: true, imbalanceDelta: "1000.00" })} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/desequilibrio|diferencia|imbalance/i);
  });

  it("(c) shows multipleCA warning banner when multipleCA: true", () => {
    render(<InitialBalanceView statement={makeStatement({ multipleCA: true, caCount: 2 })} />);

    const warning = screen.getByRole("status");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent(/múltiples|multiple|varios|comprobante.*apertura/i);
  });

  it("(d1) formats positive amount 1234.56 as 'Bs. 1.234,56' via formatBOB", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // "Caja" row has amount "1234.56"
    expect(screen.getByText("Bs. 1.234,56")).toBeInTheDocument();
  });

  it("(d2) formats negative amount -1234.56 with Bs. prefix and minus sign", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // "Deudas" row has amount "-1234.56"
    // formatBOB(-1234.56) → "Bs. -1.234,56"
    expect(screen.getByText("Bs. -1.234,56")).toBeInTheDocument();
  });

  it("(e) zero-amount detail rows are NOT rendered", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // "Banco" has amount "0" — must not appear in the DOM
    expect(screen.queryByText("Banco")).not.toBeInTheDocument();
    // "Capital" has amount "0" — must not appear in the DOM
    expect(screen.queryByText("Capital")).not.toBeInTheDocument();
  });

  it("(d4) zero totals and subtotals still render (structural zero shows as Bs. 0,00)", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // ACTIVO subtotal is "0.00" and sectionTotal is "0.00" → must render something with 0
    // formatBOB("0.00") → "Bs. 0,00"
    const zeros = screen.getAllByText("Bs. 0,00");
    expect(zeros.length).toBeGreaterThan(0);
  });

  it("(f) renders sections in correct order: ACTIVO first, then PASIVO Y PATRIMONIO", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    const headings = screen.getAllByText(/^(ACTIVO|PASIVO Y PATRIMONIO)$/);
    expect(headings[0].textContent).toBe("ACTIVO");
    expect(headings[1].textContent).toBe("PASIVO Y PATRIMONIO");
  });
});
