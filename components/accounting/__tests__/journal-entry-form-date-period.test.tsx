/**
 * RED phase — Phase 2 component tests for journal-entry-form date-aware period auto-selection.
 *
 * Change: journal-form-date-aware-period
 * Spec:   openspec/changes/journal-form-date-aware-period/specs/journal-entry-form-ux/spec.md
 *
 * JF-T01 — Auto-select on mount, new entry (REQ-1, JF-T01)
 * JF-T02 — Date change re-selects period (REQ-1, JF-T02)
 * JF-T03 — Manual override wins on date change (REQ-1, JF-T03)
 * JF-T04 — No match → warning visible and submit disabled (REQ-2 + REQ-3)
 * JF-T05 — Match restored → warning hidden and submit re-enabled (REQ-2)
 * JF-T06 — Edit mode mount preserves editEntry.periodId (REQ-1, JF-T06)
 * JF-T07 — Edit mode date change re-selects (REQ-1, JF-T07)
 * JF-T08 — Inclusive startDate boundary (REQ-4, JF-T08)
 * JF-T09 — Inclusive endDate boundary (REQ-4, JF-T09)
 *
 * TZ NOTE: Bolivia is UTC-4. All period dates use explicit UTC midnight (T00:00:00.000Z)
 * so that .toISOString().slice(0,10) returns the correct calendar date.
 * Date inputs are strings "YYYY-MM-DD" — never construct Date from them for comparison.
 */

import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Radix UI polyfills (required in jsdom) ────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

afterEach(() => cleanup());

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/accounting/journal-line-row", () => ({
  default: () => null,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import JournalEntryForm from "../journal-entry-form";

// ── Shared fixtures ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePeriod(overrides: Record<string, unknown> = {}): any {
  return {
    id: "period-april",
    name: "Abril 2026",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T00:00:00.000Z"),
    status: "OPEN",
    organizationId: "org-1",
    year: 2026,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_VOUCHER_TYPE: any = {
  id: "vt-1",
  code: "CE",
  name: "Egreso",
  description: null,
  isActive: true,
  organizationId: "org-1",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_ACCOUNT: any = {
  id: "acc-1",
  code: "1.1.1",
  name: "Caja",
  type: "ACTIVO",
  nature: "DEUDORA",
  subtype: null,
  isDetail: true,
  requiresContact: false,
  isActive: true,
  organizationId: "org-1",
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: null,
};

const APRIL_PERIOD = makePeriod();

const MAY_PERIOD = makePeriod({
  id: "period-may",
  name: "Mayo 2026",
  startDate: new Date("2026-05-01T00:00:00.000Z"),
  endDate: new Date("2026-05-31T00:00:00.000Z"),
  status: "OPEN",
});

/** Select the period <Select> trigger and click an option by visible text */
async function selectPeriodOption(name: string) {
  const triggers = screen.getAllByRole("combobox");
  // The period Select is the first combobox (Date field is an <input type="date">, not combobox)
  const trigger = triggers[0];
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
  const option = await screen.findByRole("option", { name: new RegExp(name) });
  fireEvent.click(option);
}

// ── JF-T01 — Auto-select on mount, new entry ──────────────────────────────────

describe("JF-T01 — Auto-select on mount: new entry with date inside OPEN period", () => {
  it("periodId is auto-set to the matching OPEN period on mount", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    // The period Select combobox should display "Abril 2026"
    // We locate the period Select by its label
    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    // The combobox in the period container should show the period name
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Abril 2026");
  });
});

// ── JF-T02 — Date change re-selects period ────────────────────────────────────

describe("JF-T02 — Date change re-selects period (no manual override)", () => {
  it("changing date to May auto-sets periodId to May period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD, MAY_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    // Initially date is today (2026-04-xx from todayLocal) → APRIL_PERIOD auto-selected
    // Change date to a May date
    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-05-15" } });

    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Mayo 2026");
  });
});

// ── JF-T03 — Manual override wins on date change ─────────────────────────────

describe("JF-T03 — Manual period override is NOT overwritten by subsequent date changes", () => {
  it("after user selects period manually, date change does not overwrite periodId", async () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD, MAY_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    // Manually select May period via the Select widget
    await selectPeriodOption("Mayo 2026");

    // Now change date to an April date (would normally auto-select April)
    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-04-15" } });

    // periodId MUST remain May (manual override wins)
    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Mayo 2026");
  });
});

// ── JF-T04 — No match → warning visible and submit disabled ──────────────────

describe("JF-T04 — Uncovered date shows warning banner and disables submit", () => {
  it("warning banner with role=alert is visible when date is not covered by any OPEN period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "No hay un período abierto que cubra esta fecha",
    );
  });

  it("submit button is disabled when date is not covered by any OPEN period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });

    // Find submit buttons (Guardar Borrador and/or Contabilizar)
    const submitButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.getAttribute("type") === "submit" ||
          btn.textContent?.includes("Guardar Borrador") ||
          btn.textContent?.includes("Contabilizar"),
      );
    // At least one submit button must be disabled
    expect(submitButtons.some((btn) => btn.hasAttribute("disabled"))).toBe(true);
  });
});

// ── JF-T05 — Match restored → warning hidden and periodId auto-set ────────────

describe("JF-T05 — Covered date after uncovered: warning hidden, periodId set", () => {
  it("warning banner disappears and period is auto-set when date returns to a covered value", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);

    // Set to uncovered date
    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Restore to covered date (April)
    fireEvent.change(dateInput, { target: { value: "2026-04-20" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Abril 2026");
  });
});

// ── JF-T06 — Edit mode: mount preserves editEntry.periodId ───────────────────

describe("JF-T06 — Edit mode mount preserves editEntry.periodId", () => {
  it("periodId is not auto-overwritten on mount in edit mode", () => {
    const editEntry = {
      id: "entry-1",
      number: 42,
      date: "2026-04-15",
      description: "Test entry",
      periodId: "period-april",
      voucherTypeId: "vt-1",
      referenceNumber: null,
      lines: [
        { accountId: "acc-1", debit: 100, credit: 0, description: null, contactId: null },
        { accountId: "acc-1", debit: 0, credit: 100, description: null, contactId: null },
      ],
    };

    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={editEntry}
      />,
    );

    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Abril 2026");
  });
});

// ── JF-T07 — Edit mode: date change re-selects period ────────────────────────

describe("JF-T07 — Edit mode: date change re-selects period (no manual override)", () => {
  it("changing date in edit mode auto-updates periodId to the matching OPEN period", () => {
    const editEntry = {
      id: "entry-1",
      number: 42,
      date: "2026-04-15",
      description: "Test entry",
      periodId: "period-april",
      voucherTypeId: "vt-1",
      referenceNumber: null,
      lines: [
        { accountId: "acc-1", debit: 100, credit: 0, description: null, contactId: null },
        { accountId: "acc-1", debit: 0, credit: 100, description: null, contactId: null },
      ],
    };

    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD, MAY_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={editEntry}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-05-10" } });

    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Mayo 2026");
  });
});

// ── JF-T08 — Inclusive startDate boundary ────────────────────────────────────

describe("JF-T08 — Inclusive startDate boundary (REQ-4)", () => {
  it("date equal to period.startDate matches and sets periodId", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });

    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Abril 2026");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ── JF-T09 — Inclusive endDate boundary ──────────────────────────────────────

describe("JF-T09 — Inclusive endDate boundary (REQ-4)", () => {
  it("date equal to period.endDate matches and sets periodId", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-04-30" } });

    const periodLabel = screen.getByText(/período/i);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const periodContainer = periodLabel.closest("div")!;
    expect(within(periodContainer).getByRole("combobox")).toHaveTextContent("Abril 2026");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
