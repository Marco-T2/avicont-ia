/**
 * T57 — RED: MonthlyClosePanel balance display and justification input tests.
 *
 * Asserts:
 * (a) Shows DEBE≠HABER banner when summary.balance.balanced = false.
 * (b) Passes justification string in POST body.
 *
 * Fails until T58 adds balance field handling and justification textarea.
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthlyClosePanel } from "@/components/settings/monthly-close-panel";

afterEach(() => cleanup());

beforeEach(() => {
  // Radix UI pointer/scroll polyfills
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const PERIOD_ID = "period-abc-123";
const PERIOD_NAME = "Abril 2026";

const defaultPeriods = [
  {
    id: PERIOD_ID,
    name: PERIOD_NAME,
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-04-30T00:00:00.000Z",
    status: "OPEN",
  },
];

function makeSummaryResponse(
  balanced: boolean,
  totalDebit = "100.00",
  totalCredit = "95.00",
  difference = "5.00",
) {
  return {
    ok: true,
    json: async () => ({
      periodId: PERIOD_ID,
      periodStatus: "OPEN",
      posted: { dispatches: 1, payments: 1, journalEntries: 1 },
      drafts: { dispatches: 0, payments: 0, journalEntries: 0 },
      journalsByVoucherType: [],
      balance: { balanced, totalDebit, totalCredit, difference },
    }),
  };
}

async function selectPeriod() {
  // Open the Radix Select combobox
  const trigger = screen.getByRole("combobox");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);

  // Wait for the option to appear in the portal and click it
  const option = await screen.findByRole("option", { name: new RegExp(PERIOD_NAME) });
  fireEvent.click(option);
}

describe("MonthlyClosePanel — T57 RED tests", () => {
  it("MonthlyClosePanel shows DEBE=HABER balance status from summary", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeSummaryResponse(false, "100.00", "95.00", "5.00"),
    ) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug="test-org" periods={defaultPeriods} />);

    await selectPeriod();

    // Should render a warning banner mentioning the imbalance
    const banner = await screen.findByText(/5\.00|diferencia|desbalance|DEBE.*HABER|no coincide/i);
    expect(banner).toBeInTheDocument();
  });

  it("MonthlyClosePanel passes justification to POST payload", async () => {
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        periodId: PERIOD_ID,
        periodStatus: "CLOSED",
        closedAt: new Date().toISOString(),
        correlationId: "corr-uuid-1234",
        locked: { dispatches: 1, payments: 1, journalEntries: 1, sales: 0, purchases: 0 },
      }),
    });

    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") {
        return postMock(url, opts);
      }
      // GET summary — balanced so canClose=true
      return Promise.resolve(makeSummaryResponse(true, "100.00", "100.00", "0.00"));
    }) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug="test-org" periods={defaultPeriods} />);

    await selectPeriod();

    // Wait for summary to load and close button to be enabled
    const closeBtn = await screen.findByRole("button", { name: /cerrar período/i });
    await waitFor(() => expect(closeBtn).not.toBeDisabled());

    // Open the confirm dialog
    fireEvent.click(closeBtn);

    // Type justification
    const textarea = await screen.findByPlaceholderText(/justificación/i);
    fireEvent.change(textarea, { target: { value: "Justificación de prueba completa" } });

    // Confirm close
    const confirmBtn = screen.getByRole("button", { name: /confirmar cierre/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(postMock).toHaveBeenCalled());

    const [, options] = postMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.justification).toBe("Justificación de prueba completa");
  });
});
