/**
 * RED — LedgerPageClient opening-balance banner → in-table row (D5'').
 *
 * D5 UX evolution second iteration. Banner div above table is inferior
 * to the standard accounting convention of an in-table opening row
 * ("Saldo anterior" / "Saldo inicial"). Marco-specified shape:
 *
 *   - First `<tr>` of `<tbody>`, decorative (NOT counted in `total` /
 *     pagination), aria-label "Saldo inicial acumulado".
 *   - Descripción cell text "Saldo inicial acumulado" (text change from
 *     "Saldo de Apertura" — more accurate semantics: cumulative
 *     carry-over from history before the filter window).
 *   - Saldo cell renders the opening amount via formatCurrency.
 *   - Coexists with empty-state placeholder when `items.length === 0`
 *     AND `openingBalance !== "0.00"` (Marco's Case C — all history is
 *     prior to filter range).
 *
 * Spec chain (per [[named_rule_immutability]]):
 *   - Original SC-5 (proposal #2552): visibility `page > 1 AND opening
 *     !== "0.00"` — banner div above table.
 *   - SC-5' (engram #2574, Bug #3 / `a51877dc`): visibility `opening
 *     !== "0.00"` (page-independent) — banner div still above table.
 *   - SC-5'' (this delta): SAME visibility, but shape changes from
 *     banner div to decorative `<tr>` inside `<tbody>`, AND text
 *     changes "Saldo de Apertura" → "Saldo inicial acumulado".
 *
 * Expected RED failure modes (per [[red_acceptance_failure_mode]]):
 *   1. `<tr aria-label="Saldo inicial acumulado">` query returns null —
 *      current impl renders banner `<div>`, not a `<tr>`.
 *   2. Text "Saldo inicial acumulado" NOT in document AND text "Saldo
 *      de Apertura" IS in document — text change pending.
 *   3. Empty-state + opening-row coexistence: in current banner shape,
 *      the banner div renders OUTSIDE/ABOVE the table — the aria-label
 *      `<tr>` query returns null even though the empty-state `<tr>`
 *      renders. New shape integrates opening row into `<tbody>` so
 *      BOTH are queryable rows.
 *
 * Per [[mock_hygiene_commit_scope]]: the existing banner test (added
 * in Bug #3 RED `d47641db`) is UPDATED atomically in this RED commit
 * alongside the two NEW tests — no banner-shape assertion is left
 * behind to false-pass against the new in-table `<tr>` shape.
 */

import { render, screen, within, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

const ACCOUNT = {
  id: "acc-1",
  code: "1.1.01",
  name: "Caja",
  isActive: true,
  isDetail: true,
} as unknown as import("@/generated/prisma/client").Account;

function makeLedger(overrides: Partial<{
  page: number;
  openingBalance: string;
  items: Array<{
    date: string;
    entryNumber: number;
    description: string;
    debit: string;
    credit: string;
    balance: string;
  }>;
  total: number;
}> = {}) {
  return {
    items: overrides.items ?? [],
    total: overrides.total ?? 0,
    page: overrides.page ?? 1,
    pageSize: 25,
    totalPages: 1,
    openingBalance: overrides.openingBalance ?? "0.00",
  };
}

afterEach(() => cleanup());

// ── Import after mocks ────────────────────────────────────────────────────────

import LedgerPageClient from "../ledger-page-client";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LedgerPageClient — opening balance in-table row (D5'')", () => {
  it("renders opening row as <tr> with aria-label and Saldo cell on page 1 when openingBalance is non-zero", () => {
    render(
      <LedgerPageClient
        orgSlug={ORG_SLUG}
        accounts={[ACCOUNT]}
        ledger={makeLedger({
          page: 1,
          openingBalance: "120.00",
          total: 1,
          items: [
            {
              date: "2025-06-01T00:00:00.000Z",
              entryNumber: 1,
              description: "Movimiento dentro del rango",
              debit: "50.00",
              credit: "0.00",
              balance: "170.00",
            },
          ],
        })}
        filters={{ accountId: ACCOUNT.id, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
      />,
    );

    // Opening row is a <tr> with aria-label — banner <div> does NOT match.
    const openingRow = screen.getByRole("row", {
      name: /Saldo inicial acumulado/i,
    });
    expect(openingRow).toBeInTheDocument();
    expect(openingRow.tagName).toBe("TR");

    // Saldo cell within the opening row renders the formatted opening amount.
    // formatCurrency uses es-BO locale → "Bs. 120,00" (comma decimal separator).
    expect(within(openingRow).getByText(/Bs\.\s*120[.,]00/)).toBeInTheDocument();
  });

  it("opening row text says 'Saldo inicial acumulado' not 'Saldo de Apertura'", () => {
    render(
      <LedgerPageClient
        orgSlug={ORG_SLUG}
        accounts={[ACCOUNT]}
        ledger={makeLedger({
          page: 1,
          openingBalance: "120.00",
          total: 1,
          items: [
            {
              date: "2025-06-01T00:00:00.000Z",
              entryNumber: 1,
              description: "Movimiento dentro del rango",
              debit: "50.00",
              credit: "0.00",
              balance: "170.00",
            },
          ],
        })}
        filters={{ accountId: ACCOUNT.id, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
      />,
    );

    expect(screen.queryByText(/Saldo inicial acumulado/i)).toBeInTheDocument();
    expect(screen.queryByText(/Saldo de [Aa]pertura/)).not.toBeInTheDocument();
  });

  it("opening row renders alongside empty-state placeholder when items=[] and openingBalance !== '0.00' (Marco Case C)", () => {
    render(
      <LedgerPageClient
        orgSlug={ORG_SLUG}
        accounts={[ACCOUNT]}
        ledger={makeLedger({
          page: 1,
          openingBalance: "960.00",
          total: 0,
          items: [],
        })}
        filters={{ accountId: ACCOUNT.id, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
      />,
    );

    // Opening row present — <tr> with aria-label + Bs. 960,00 in Saldo cell
    // (formatCurrency es-BO locale → comma decimal separator).
    const openingRow = screen.getByRole("row", {
      name: /Saldo inicial acumulado/i,
    });
    expect(openingRow).toBeInTheDocument();
    expect(within(openingRow).getByText(/Bs\.\s*960[.,]00/)).toBeInTheDocument();

    // Empty-state placeholder ALSO present (below opening row).
    expect(
      screen.getByText(/No hay movimientos para esta cuenta/i),
    ).toBeInTheDocument();
  });
});
