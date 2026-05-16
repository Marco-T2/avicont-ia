/**
 * MonthlyClosePanel — tests for the static-label flow (no combobox).
 *
 * The panel previously rendered a Select that let users switch periods
 * after arriving from /settings/periods. That created two bugs:
 *  - Confusing UX (page came preloaded for the picked month but the combo
 *    suggested freedom to switch).
 *  - Risk of manually closing December, breaking annual-close atomicity.
 *
 * New contract: the panel takes a single `selectedPeriod` prop, shows the
 * name as a static label + status badge, and auto-fetches the summary on
 * mount. The page is responsible for redirecting to /settings/periods when
 * no valid OPEN periodId is present in the URL.
 *
 * Asserts:
 *  (a) Shows DEBE≠HABER banner when summary.balance.balanced = false.
 *  (b) POSTs only { periodId } on confirm-close (justification is now auto-
 *      generated server-side; textarea removed from UI per annual-close mirror).
 *  (c) Auto-fetches summary on mount for selectedPeriod.id.
 *  (d) Renders period name as static label (NO combobox).
 *  (e) toast.success on close includes "Ver registro" action navigating to
 *      the close-event page with correlationId.
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock factories ─────────────────────────────────────────────────────

const { mockRouterRefresh, mockRouterPush } = vi.hoisted(() => ({
  mockRouterRefresh: vi.fn(),
  mockRouterPush: vi.fn(),
}));

// ── Module mocks (all top-level, hoisted by Vitest) ───────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: mockRouterPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

// ── Imports after mocks ────────────────────────────────────────────────────────

import { MonthlyClosePanel } from "@/components/accounting/monthly-close-panel";
import { toast } from "sonner";

const mockToastSuccess = vi.mocked(toast.success);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Shared fixtures ────────────────────────────────────────────────────────────

const PERIOD_ID = "period-abc-123";
const PERIOD_NAME = "Abril 2026";
const ORG_SLUG = "test-org";

const selectedPeriod = {
  id: PERIOD_ID,
  name: PERIOD_NAME,
  startDate: "2026-04-01T00:00:00.000Z",
  endDate: "2026-04-30T00:00:00.000Z",
  status: "OPEN",
};

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
      drafts: { dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 0 },
      journalsByVoucherType: [],
      balance: { balanced, totalDebit, totalCredit, difference },
    }),
  };
}

// ── Static-label contract ─────────────────────────────────────────────────────

describe("MonthlyClosePanel — static label (no combobox)", () => {
  it("(d) renders the period name as static label and does NOT render a combobox", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeSummaryResponse(true, "100.00", "100.00", "0.00"),
    ) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} selectedPeriod={selectedPeriod} />);

    // Period name is shown directly (static), not behind a select.
    expect(screen.getByText(PERIOD_NAME)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("(c) auto-fetches summary for selectedPeriod.id on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSummaryResponse(true, "0.00", "0.00", "0.00"),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} selectedPeriod={selectedPeriod} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`summary?periodId=${PERIOD_ID}`),
      );
    });
  });
});

// ── Balance + close flow ──────────────────────────────────────────────────────

describe("MonthlyClosePanel — balance + close flow", () => {
  it("(a) shows DEBE≠HABER warning when summary.balance.balanced = false", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeSummaryResponse(false, "100.00", "95.00", "5.00"),
    ) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} selectedPeriod={selectedPeriod} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/5\.00/);
    expect(alert).toHaveTextContent(/DEBE.*HABER/i);
  });

  it("(b) POSTs only { periodId } on confirm-close (justification auto-generated server-side)", async () => {
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
      return Promise.resolve(makeSummaryResponse(true, "100.00", "100.00", "0.00"));
    }) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} selectedPeriod={selectedPeriod} />);

    const closeBtn = await screen.findByRole("button", { name: /cerrar período/i });
    await waitFor(() => expect(closeBtn).not.toBeDisabled());

    fireEvent.click(closeBtn);

    const confirmBtn = await screen.findByRole("button", { name: /confirmar cierre/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(postMock).toHaveBeenCalled());

    const [, options] = postMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({ periodId: PERIOD_ID });
    expect(body).not.toHaveProperty("justification");
  });
});

// ── REQ-3 — correlationId toast action ────────────────────────────────────────

describe("MonthlyClosePanel — REQ-3: correlationId toast action after successful close", () => {
  it("(e) toast.success called with action.label 'Ver registro' and onClick navigates to close-event", async () => {
    const CORRELATION_ID = "evt-01";

    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        periodId: PERIOD_ID,
        periodStatus: "CLOSED",
        closedAt: new Date().toISOString(),
        correlationId: CORRELATION_ID,
        locked: { dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 0 },
      }),
    });

    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return postMock(url, opts);
      return Promise.resolve(makeSummaryResponse(true, "0.00", "0.00", "0.00"));
    }) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} selectedPeriod={selectedPeriod} />);

    const closeBtn = await screen.findByRole("button", { name: /cerrar período/i });
    await waitFor(() => expect(closeBtn).not.toBeDisabled());
    fireEvent.click(closeBtn);

    const confirmBtn = await screen.findByRole("button", { name: /confirmar cierre/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    const [, toastOptions] = mockToastSuccess.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(toastOptions.action).toBeDefined();
    expect(toastOptions.action.label).toBe("Ver registro");
    expect(typeof toastOptions.action.onClick).toBe("function");

    toastOptions.action.onClick();
    expect(mockRouterPush).toHaveBeenCalledWith(
      `/${ORG_SLUG}/accounting/monthly-close/close-event?correlationId=${CORRELATION_ID}`,
    );
  });
});
