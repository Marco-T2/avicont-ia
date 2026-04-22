/**
 * T57 — RED: MonthlyClosePanel balance display and justification input tests.
 * REQ-2 — preselectedPeriodId pre-selection.
 * REQ-3 — correlationId toast action fires after successful close.
 *
 * Asserts:
 * (a) Shows DEBE≠HABER banner when summary.balance.balanced = false.
 * (b) Passes justification string in POST body.
 * (c) REQ-2a: preselectedPeriodId triggers auto-fetch on mount.
 * (d) REQ-3a: toast.success called with action.label 'Ver registro' + onClick navigates to close-event.
 *
 * Relocated from components/settings/__tests__/monthly-close-panel.test.tsx
 * as part of REQ-6 panel move to components/accounting/ (INV-3 atomic).
 *
 * Rule 4 discipline: sonner mock is NOT aspirational. sonner v2.0.7 supports
 * action: { label, onClick } (verified in node_modules/sonner/dist/index.d.ts
 * interface Action { label: React.ReactNode; onClick: (event) => void }).
 * The mock captures call args; it does not encode fabricated behavior.
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

// ── Shared fixtures ────────────────────────────────────────────────────────────

const PERIOD_ID = "period-abc-123";
const PERIOD_NAME = "Abril 2026";
const ORG_SLUG = "test-org";

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
      drafts: { dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 0 },
      journalsByVoucherType: [],
      balance: { balanced, totalDebit, totalCredit, difference },
    }),
  };
}

async function selectPeriod(periodName = PERIOD_NAME) {
  // Open the Radix Select combobox
  const trigger = screen.getByRole("combobox");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);

  // Wait for the option to appear in the portal and click it
  const option = await screen.findByRole("option", { name: new RegExp(periodName) });
  fireEvent.click(option);
}

// ── T57 existing tests ─────────────────────────────────────────────────────────

describe("MonthlyClosePanel — T57 RED tests", () => {
  it("MonthlyClosePanel shows DEBE=HABER balance status from summary", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeSummaryResponse(false, "100.00", "95.00", "5.00"),
    ) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} periods={defaultPeriods} />);

    await selectPeriod();

    // Should render a warning banner mentioning the imbalance
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    // Banner must contain the difference value
    expect(alert).toHaveTextContent(/5\.00/);
    expect(alert).toHaveTextContent(/DEBE.*HABER/i);
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

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} periods={defaultPeriods} />);

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

// ── REQ-2 panel-side — preselectedPeriodId ────────────────────────────────────

const PRESELECT_PERIOD_ID = "p-preselect";
const preselectPeriods = [
  {
    id: PRESELECT_PERIOD_ID,
    name: "Enero 2026",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-01-31T00:00:00.000Z",
    status: "OPEN",
  },
];

describe("MonthlyClosePanel — REQ-2: preselectedPeriodId pre-selection", () => {
  it("REQ-2a — auto-fetches summary for preselectedPeriodId on mount", async () => {
    // RED: panel does not yet consume preselectedPeriodId prop
    // Expected RED failure: fetch is not called on mount (no auto-fetch without prop support)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        periodId: PRESELECT_PERIOD_ID,
        periodStatus: "OPEN",
        posted: { dispatches: 0, payments: 0, journalEntries: 0 },
        drafts: { dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 0 },
        journalsByVoucherType: [],
        balance: { balanced: true, totalDebit: "0.00", totalCredit: "0.00", difference: "0.00" },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MonthlyClosePanel
        orgSlug={ORG_SLUG}
        periods={preselectPeriods}
        preselectedPeriodId={PRESELECT_PERIOD_ID}
      />,
    );

    // Assert auto-fetch fires immediately with the preselected period id
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`summary?periodId=${PRESELECT_PERIOD_ID}`),
      );
    });
  });
});

// ── REQ-3 — correlationId toast action ────────────────────────────────────────

describe("MonthlyClosePanel — REQ-3: correlationId toast action after successful close", () => {
  it("REQ-3a — toast.success called with action.label 'Ver registro' and action.onClick navigates to close-event", async () => {
    // RED: panel does not yet call toast.success on success
    // Expected RED failure: toast.success was not called at all
    // Rule 4: sonner v2.0.7 Action interface verified — { label: ReactNode; onClick: fn }
    const CORRELATION_ID = "evt-01";

    const postMockREQ3 = vi.fn().mockResolvedValue({
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
      if (opts?.method === "POST") return postMockREQ3(url, opts);
      return Promise.resolve(makeSummaryResponse(true, "0.00", "0.00", "0.00"));
    }) as unknown as typeof fetch;

    render(<MonthlyClosePanel orgSlug={ORG_SLUG} periods={defaultPeriods} />);

    // Select the period manually
    await selectPeriod();

    // Wait for close button to be enabled
    const closeBtn = await screen.findByRole("button", { name: /cerrar período/i });
    await waitFor(() => expect(closeBtn).not.toBeDisabled());
    fireEvent.click(closeBtn);

    const confirmBtn = await screen.findByRole("button", { name: /confirmar cierre/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(postMockREQ3).toHaveBeenCalled());

    // Assert toast.success was called with action containing "Ver registro"
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    const [, toastOptions] = mockToastSuccess.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(toastOptions.action).toBeDefined();
    expect(toastOptions.action.label).toBe("Ver registro");
    expect(typeof toastOptions.action.onClick).toBe("function");

    // Invoke the action onClick and assert router.push was called with correlationId URL
    toastOptions.action.onClick();
    expect(mockRouterPush).toHaveBeenCalledWith(
      `/${ORG_SLUG}/accounting/monthly-close/close-event?correlationId=${CORRELATION_ID}`,
    );
  });
});
