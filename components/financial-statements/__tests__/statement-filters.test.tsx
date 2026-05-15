/**
 * RED — statement-filters defaults + current period auto-selection.
 *
 * Mirrors the worksheet / trial-balance UX (commits 07474e34, 11b6105b):
 * after the periods fetch resolves:
 *  - if a period covers today AND status === "OPEN" → pre-select it
 *  - otherwise → set date defaults per mode
 *      • balance-sheet: asOfDate = today
 *      • income-statement: dateFrom = today - 1 month, dateTo = today
 *
 * The component reads "today" via `new Date()` — tests use
 * `vi.useFakeTimers({ toFake: ["Date"] })` so promises (fetch) still
 * resolve naturally while Date.now() is deterministic.
 */
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatementFilters } from "../statement-filters";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("StatementFilters — defaults + current period", () => {
  it("auto-selects the OPEN period covering today after periods fetch resolves", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "p-may", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31", status: "OPEN" },
        { id: "p-apr", name: "Abril 2026", startDate: "2026-04-01", endDate: "2026-04-30", status: "CLOSED" },
      ],
    });

    render(<StatementFilters orgSlug="test-org" mode="balance-sheet" onSubmit={vi.fn()} />);

    // Wait until loadingPeriods resolves and the auto-selection lands in the Select.
    await waitFor(() => {
      expect(screen.getByText(/mayo 2026/i)).toBeInTheDocument();
    });
  });

  it("defaults asOfDate to today (YYYY-MM-DD) when no current period exists [balance-sheet]", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<StatementFilters orgSlug="test-org" mode="balance-sheet" onSubmit={vi.fn()} />);

    await waitFor(() => {
      const asOf = screen.getByLabelText(/fecha de corte/i) as HTMLInputElement;
      expect(asOf.value).toBe("2026-05-15");
    });
  });

  it("defaults dateFrom/dateTo (today-1m / today) when no current period exists [income-statement]", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<StatementFilters orgSlug="test-org" mode="income-statement" onSubmit={vi.fn()} />);

    await waitFor(() => {
      const from = screen.getByLabelText(/^desde/i) as HTMLInputElement;
      const to = screen.getByLabelText(/^hasta/i) as HTMLInputElement;
      expect(from.value).toBe("2026-04-15");
      expect(to.value).toBe("2026-05-15");
    });
  });

  it("does NOT auto-select a CLOSED period covering today (only OPEN periods qualify)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "p-may", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31", status: "CLOSED" },
      ],
    });

    render(<StatementFilters orgSlug="test-org" mode="balance-sheet" onSubmit={vi.fn()} />);

    // Fallback: the date input shows today because no OPEN period qualified.
    await waitFor(() => {
      const asOf = screen.getByLabelText(/fecha de corte/i) as HTMLInputElement;
      expect(asOf.value).toBe("2026-05-15");
    });
  });
});
