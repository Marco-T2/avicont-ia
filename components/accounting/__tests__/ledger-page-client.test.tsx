/**
 * RED — LedgerPageClient opening-balance banner page1 visibility.
 *
 * Asserts that the "Saldo de Apertura" banner renders on page 1 when
 * `openingBalance !== "0.00"` — the case enabled by bugfix `792831d6`
 * (Bug #2 historical opening). Before the GREEN fix, the banner is
 * gated behind `ledger.page > 1 &&`, so this test fails with
 * TestingLibraryElementError on page 1.
 *
 * Spec history: original SC-5 (proposal #2552) locked visibility as
 * `page > 1 AND openingBalance !== "0.00"`, drafted when opening could
 * ONLY be non-zero on page > 1. After Bug #2 enabled historical priors
 * (date < dateFrom) to contribute to opening on ANY page, the
 * `page > 1` gate became redundant-but-wrong. SC-5 is superseded —
 * banner now renders iff `openingBalance !== "0.00"` (page-independent).
 *
 * Expected RED failure mode (per [[red_acceptance_failure_mode]]):
 *   TestingLibraryElementError: Unable to find an element with the text
 *   /Saldo de Apertura.*120\.00/
 */

import { render, screen, cleanup } from "@testing-library/react";
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

describe("LedgerPageClient — opening balance banner (post Bug #2)", () => {
  it("renders opening balance banner on page 1 when openingBalance is non-zero", () => {
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

    expect(screen.getByText(/Saldo de Apertura.*120\.00/)).toBeInTheDocument();
  });
});
