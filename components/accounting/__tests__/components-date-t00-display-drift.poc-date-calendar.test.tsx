/**
 * POC date-calendar-vs-instant-convention C2 RED — display-globalization
 * drift in ledger / payable / receivable component renders.
 *
 * Hypothesis: with `TZ=America/La_Paz` set in vitest.config (P0.21 verified
 * present in Step 0 audit #2600), passing a calendar-day Date at T00 UTC
 * to the local `formatDate(...)` helpers in these components triggers
 * `toLocaleDateString("es-BO")` to render the PREVIOUS day (BO is UTC-4 →
 * UTC midnight = 20:00 local of the prior calendar day).
 *
 * Sister precedent #2233 (Bug B sweep) replaced 6 non-accounting components
 * with `formatDateBO` (pure ISO-slice, TZ-safe by construction). This POC
 * extends the sweep to 3 accounting components (ledger / payable / receivable)
 * — same fix pattern per [[paired_sister_default_no_surface]].
 *
 * Failure mode declared (pre-GREEN, per [[red_acceptance_failure_mode]]):
 *   SC-7 (ledger T00 row): expected "15/05/2026", current renders
 *     "14 may. 2026" (locale short month + D-1 drift) → MISMATCH on getByText
 *   SC-10 (payable T00 dueDate): same shape — "14/05/2026" expected,
 *     receives "13 may. 2026" → MISMATCH
 *   SC-11 (receivable T00 dueDate): same shape → MISMATCH
 *   SC-8 / SC-9 preservation: T12 input must render correct day (currently
 *     PASSES with locale-short format; post-GREEN PASSES with DD/MM/YYYY).
 *
 * Tests assert the DD/MM/YYYY shape (formatDateBO output) — both reasons
 * fail today: (1) format is "DD mes. YYYY" not "DD/MM/YYYY", (2) day is
 * off-by-one for T00 inputs.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import LedgerPageClient from "../ledger-page-client";
import PayableList from "../payable-list";
import ReceivableList from "../receivable-list";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/contacts/contact-selector", () => ({
  default: () => <div data-testid="contact-selector" />,
}));

vi.mock("@/components/accounting/account-selector", () => ({
  default: () => <div data-testid="account-selector" />,
}));

vi.mock("../payable-form", () => ({ default: () => null }));
vi.mock("../receivable-form", () => ({ default: () => null }));
vi.mock("../status-update-dialog", () => ({ default: () => null }));

const ORG_SLUG = "test-org";

const ACCOUNT = {
  id: "acc-1",
  code: "1.1.01",
  name: "Caja",
  isActive: true,
  isDetail: true,
  organizationId: "org-1",
  parentId: null,
  type: "ACTIVO",
  level: 3,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("POC date-calendar-vs-instant-convention C2 — components render calendar-day Date as DD/MM/YYYY without TZ drift (ledger + payable + receivable formatDateBO sweep — sister precedent #2233 Bug B EXACT mirror per [[paired_sister_default_no_surface]])", () => {
  describe("SC-7: LedgerPageClient — T00 entry.date renders as DD/MM/YYYY of the same calendar day", () => {
    it("SC-7: ledger row with entry.date='2026-05-15T00:00:00.000Z' renders '15/05/2026' (current: local formatDate → '14 may. 2026' MISMATCH)", () => {
      const ledger = {
        items: [
          {
            date: "2026-05-15T00:00:00.000Z",
            entryNumber: 1,
            description: "Test entry",
            debit: "100.00",
            credit: "0.00",
            balance: "100.00",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        openingBalance: "0.00",
      };
      render(
        <LedgerPageClient
          orgSlug={ORG_SLUG}
          accounts={[ACCOUNT as any]}
          ledger={ledger as any}
          filters={{ accountId: "acc-1" }}
        />,
      );
      expect(screen.getByText("15/05/2026")).toBeInTheDocument();
    });
  });

  describe("SC-10: PayableList — T00 dueDate renders DD/MM/YYYY of the same calendar day", () => {
    it("SC-10: payable with dueDate='2026-05-14T00:00:00.000Z' renders '14/05/2026' (current: '13 may. 2026' MISMATCH)", () => {
      const payable = {
        id: "p-1",
        organizationId: "org-1",
        contactId: "c-1",
        description: "Test",
        amount: 1000,
        paid: 0,
        balance: 1000,
        dueDate: new Date("2026-05-14T00:00:00.000Z"),
        status: "PENDING",
        contact: { id: "c-1", name: "Proveedor Uno" },
        sourceType: null,
        sourceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      render(
        <PayableList orgSlug={ORG_SLUG} payables={[payable as any]} />,
      );
      expect(screen.getByText("14/05/2026")).toBeInTheDocument();
    });
  });

  describe("SC-11: ReceivableList — T00 dueDate renders DD/MM/YYYY of the same calendar day", () => {
    it("SC-11: receivable with dueDate='2026-05-14T00:00:00.000Z' renders '14/05/2026' (current: '13 may. 2026' MISMATCH)", () => {
      const receivable = {
        id: "r-1",
        organizationId: "org-1",
        contactId: "c-1",
        description: "Test",
        amount: 1000,
        paid: 0,
        balance: 1000,
        dueDate: new Date("2026-05-14T00:00:00.000Z"),
        status: "PENDING",
        contact: { id: "c-1", name: "Cliente Uno" },
        sourceType: null,
        sourceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      render(
        <ReceivableList orgSlug={ORG_SLUG} receivables={[receivable as any]} />,
      );
      expect(screen.getByText("14/05/2026")).toBeInTheDocument();
    });
  });
});
