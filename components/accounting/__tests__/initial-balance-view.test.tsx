/**
 * T20 — RED: InitialBalanceView component tests.
 *
 * Asserts:
 * (a) Renders two sections (ACTIVO and PASIVO Y PATRIMONIO) with subtotals.
 * (b) Shows imbalance alert banner when `imbalanced: true`.
 * (c) Shows multipleCA warning banner when `multipleCA: true`.
 * (d) Amount formatting (es-BO locale):
 *     - positive 1234.56 → "1.234,56"
 *     - negative -1234.56 → "(1.234,56)" (parentheses, not minus sign)
 *     - zero in a detail/row-level cell → empty string ""
 *     - zero in a total/subtotal cell → "0,00"
 *
 * Fails because `components/accounting/initial-balance-view.tsx` does not exist yet.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

// ── Import after afterEach so cleanup runs before next suite ──────────────────
import { InitialBalanceView } from "../initial-balance-view";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVO_GROUP = {
  subtype: "CURRENT",
  label: "Activo Corriente",
  rows: [
    { accountId: "acc-1", code: "1.1.01", name: "Caja", amount: "1234.56" },
    { accountId: "acc-2", code: "1.1.02", name: "Banco", amount: "0" },
    { accountId: "acc-3", code: "1.1.03", name: "Deudas", amount: "-1234.56" },
  ],
  subtotal: "0.00",
};

const PASIVO_GROUP = {
  subtype: "CURRENT",
  label: "Pasivo Corriente",
  rows: [
    { accountId: "acc-4", code: "2.1.01", name: "Proveedores", amount: "5000.00" },
  ],
  subtotal: "5000.00",
};

const PATRIMONIO_GROUP = {
  subtype: "CAPITAL_SOCIAL",
  label: "Capital Social",
  rows: [
    { accountId: "acc-5", code: "3.1.01", name: "Capital", amount: "0" },
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
  it("(a) renders two section headings with subtotals", () => {
    render(<InitialBalanceView statement={makeStatement()} />);

    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    expect(screen.getByText("PASIVO Y PATRIMONIO")).toBeInTheDocument();

    // Group labels
    expect(screen.getByText("Activo Corriente")).toBeInTheDocument();
    expect(screen.getByText("Pasivo Corriente")).toBeInTheDocument();
    expect(screen.getByText("Capital Social")).toBeInTheDocument();

    // Account names
    expect(screen.getByText("Caja")).toBeInTheDocument();
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

  it("(d1) formats positive amount 1234.56 as 1.234,56", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // "Caja" row has amount "1234.56"
    expect(screen.getByText("1.234,56")).toBeInTheDocument();
  });

  it("(d2) formats negative amount -1234.56 as (1.234,56)", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // "Deudas" row has amount "-1234.56"
    expect(screen.getByText("(1.234,56)")).toBeInTheDocument();
  });

  it("(d3) renders empty string for zero in a detail row", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // "Banco" row has amount "0" — must not render "0,00" or "0.00" inline
    // The cell should be empty (no text node containing "0,00" for that cell)
    // We verify by confirming "0,00" only appears in subtotal/total positions
    const allCells = document.querySelectorAll("td");
    // Find the "Banco" name cell
    const bancoCell = Array.from(allCells).find((cell) => cell.textContent === "Banco");
    expect(bancoCell).toBeInTheDocument();
    // Its sibling amount cell should be empty
    const amountCell = bancoCell?.nextElementSibling;
    expect(amountCell?.textContent).toBe("");
  });

  it("(d4) renders 0,00 for zero in a total/subtotal cell", () => {
    render(<InitialBalanceView statement={makeStatement()} />);
    // ACTIVO section subtotal is "0.00" → should show "0,00"
    // Multiple "0,00" may exist; we only need at least one
    const elements = screen.getAllByText("0,00");
    expect(elements.length).toBeGreaterThan(0);
  });
});
