/**
 * statement-filters defaults + current period auto-selection.
 *
 * Mirrors the worksheet / trial-balance UX (commits 07474e34, 11b6105b)
 * AND the journal/new pattern (periods injected server-side, no client fetch):
 *  - if a period covers today AND status === "OPEN" → pre-select it
 *  - otherwise → date inputs default to (today-1m, today) so the user can
 *    submit without typing fechas
 *
 * Synchronous initial state — `findPeriodCoveringDate` runs in useState
 * initializer, so no waitFor is needed. Tests use fake timers only to pin
 * "today" deterministically.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatementFilters, type FiscalPeriod } from "../statement-filters";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("StatementFilters — defaults + current period", () => {
  it("auto-selects the OPEN period covering today (synchronous initial state)", () => {
    const periods: FiscalPeriod[] = [
      { id: "p-may", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31", status: "OPEN" },
      { id: "p-apr", name: "Abril 2026", startDate: "2026-04-01", endDate: "2026-04-30", status: "CLOSED" },
    ];

    render(<StatementFilters mode="balance-sheet" periods={periods} onSubmit={vi.fn()} />);

    // The Select trigger (combobox) shows the selected period's label.
    // Radix renders the label in both the trigger and the hidden item list,
    // so we scope the query to the combobox to avoid the duplicate match.
    const trigger = screen.getByRole("combobox", { name: /período fiscal/i });
    expect(trigger).toHaveTextContent(/mayo 2026/i);
  });

  it("defaults asOfDate to today (YYYY-MM-DD) when no current period exists [balance-sheet]", () => {
    render(<StatementFilters mode="balance-sheet" periods={[]} onSubmit={vi.fn()} />);

    const asOf = screen.getByLabelText(/fecha de corte/i) as HTMLInputElement;
    expect(asOf.value).toBe("2026-05-15");
  });

  it("defaults dateFrom/dateTo (today-1m / today) when no current period exists [income-statement]", () => {
    render(<StatementFilters mode="income-statement" periods={[]} onSubmit={vi.fn()} />);

    const from = screen.getByLabelText(/^desde/i) as HTMLInputElement;
    const to = screen.getByLabelText(/^hasta/i) as HTMLInputElement;
    expect(from.value).toBe("2026-04-15");
    expect(to.value).toBe("2026-05-15");
  });

  it("does NOT auto-select a CLOSED period covering today (only OPEN periods qualify)", () => {
    const periods: FiscalPeriod[] = [
      { id: "p-may", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31", status: "CLOSED" },
    ];

    render(<StatementFilters mode="balance-sheet" periods={periods} onSubmit={vi.fn()} />);

    // Fallback: the date input shows today because no OPEN period qualified.
    const asOf = screen.getByLabelText(/fecha de corte/i) as HTMLInputElement;
    expect(asOf.value).toBe("2026-05-15");
  });
});
