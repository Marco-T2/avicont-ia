/**
 * T2.1 — REQ-DISPLAY-1 + REQ-DISPLAY-2: LedgerPageClient renders raw
 * `String(entry.number)` for the Nro column AND for the "Ver asiento" +
 * "Abrir PDF" aria-labels. No `D\d{4}-\d{6}` or `[A-Z]{1,3}-\d{3,4}`
 * patterns may leak into rendered output.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   the component currently renders `entry.displayNumber` (the formatted
 *   `D2506-000001` string) at 3 sites — table cell L413 + aria-labels L439
 *   + L450. All three assertions FAIL because the formatted string is in
 *   the DOM, not the raw `String(entry.number)`.
 *
 * GREEN: in `ledger-page-client.tsx`, replace `entry.displayNumber` with
 *   `String(entry.entryNumber)` at the 3 sites. Service-side drop of the
 *   `displayNumber` enrichment (`ledger.service.ts:96,161,319`) +
 *   `LedgerEntry`/`ContactLedgerEntry` DTO field removal + drop of
 *   `formatCorrelativeNumber` import (L18) bundled in same commit per
 *   [[mock_hygiene_commit_scope]].
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import LedgerPageClient from "../ledger-page-client";

const ACCOUNT = {
  id: "acc-1",
  code: "1.1.01",
  name: "Caja",
  isActive: true,
  isDetail: true,
} as unknown as import("@/generated/prisma/client").Account;

const PROHIBITED = /D\d{4}-\d{6}|[A-Z]{1,3}-\d{3,4}/;

function makeLedger() {
  return {
    items: [
      {
        entryId: "je-1",
        date: "2025-06-15T00:00:00.000Z",
        entryNumber: 42,
        voucherCode: "CI",
        // formatted displayNumber present in fixture so the RED assertion
        // catches the current impl which renders `entry.displayNumber`. After
        // GREEN, the field is dropped from LedgerEntry DTO; this fixture line
        // becomes harmless extra data.
        displayNumber: "CI-042",
        description: "Cobro cliente",
        debit: "1000.00",
        credit: "0.00",
        balance: "1000.00",
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    openingBalance: "0.00",
  };
}

afterEach(cleanup);

describe("T2.1 — LedgerPageClient drops displayNumber (REQ-DISPLAY-1/2)", () => {
  it("Nro cell renders String(entry.entryNumber), NOT formatted displayNumber", () => {
    render(
      <LedgerPageClient
        orgSlug="test-org"
        accounts={[ACCOUNT]}
        ledger={makeLedger() as never}
        filters={{ accountId: "acc-1" }}
      />,
    );

    // raw entryNumber rendered
    expect(screen.getByText("42")).toBeInTheDocument();
    // no formatted prefix-pattern leaks anywhere in the document
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(PROHIBITED);
  });

  it("Ver asiento + Abrir PDF aria-labels reference raw entryNumber, NOT displayNumber", () => {
    render(
      <LedgerPageClient
        orgSlug="test-org"
        accounts={[ACCOUNT]}
        ledger={makeLedger() as never}
        filters={{ accountId: "acc-1" }}
      />,
    );

    const verAsientoLink = screen.getByRole("link", { name: /Ver asiento 42/ });
    expect(verAsientoLink).toBeInTheDocument();
    expect(verAsientoLink.getAttribute("aria-label")).not.toMatch(PROHIBITED);

    const pdfLink = screen.getByRole("link", { name: /Abrir PDF.*42/ });
    expect(pdfLink).toBeInTheDocument();
    expect(pdfLink.getAttribute("aria-label")).not.toMatch(PROHIBITED);
  });
});
