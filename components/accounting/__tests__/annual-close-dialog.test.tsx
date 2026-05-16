/**
 * AnnualCloseDialog — opens, shows summary, POSTs to API on confirm, handles
 * errors with voseo toast.
 *
 * Component contract (post-justification-removal):
 *   Props: { orgSlug, year, summary, open, onOpenChange }
 *   On confirm:
 *     POST /api/organizations/{orgSlug}/annual-close
 *     body: { year } — justification is auto-generated server-side
 *     Success → sonner toast 'Gestión cerrada exitosamente' + router.refresh
 *     Error   → sonner toast.error with server error message
 *
 * Test layer: unit (mock fetch + sonner + next/navigation).
 */
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";

afterEach(() => cleanup());

const { mockRefresh, mockPush, mockToastSuccess, mockToastError, mockFetch } =
  vi.hoisted(() => ({
    mockRefresh: vi.fn(),
    mockPush: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFetch: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockRefresh.mockReset();
  mockPush.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockFetch.mockReset();
});

import AnnualCloseDialog from "../annual-close-dialog";

const ORG_SLUG = "acme";

const HAPPY_SUMMARY: AnnualCloseSummary = {
  year: 2026,
  fiscalYearStatus: "OPEN",
  periods: { closed: 11, open: 1, total: 12 },
  decemberStatus: "OPEN",
  ccExists: false,
  gateAllowed: true,
  balance: { debit: "150000.00", credit: "150000.00", balanced: true },
};

describe("AnnualCloseDialog — REQ-7.4 voseo + POST flow", () => {
  it("when open=true, renders dialog with title 'Confirmar Cierre de Gestión' + year + summary balance", () => {
    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(
      screen.getByText(/Confirmar Cierre de Gestión/i),
    ).toBeInTheDocument();
    // Dialog body mentions year + balance figures (Debe + Haber both show 150000.00).
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getAllByText(/150000\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it("when open=false, does NOT render dialog content", () => {
    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={false}
        onOpenChange={() => {}}
      />,
    );

    expect(
      screen.queryByText(/Confirmar Cierre de Gestión/i),
    ).not.toBeInTheDocument();
  });

  it("does NOT render a textarea (justification removed — auto-generated server-side)", () => {
    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Justificación/i)).not.toBeInTheDocument();
  });

  it("Confirm button is ENABLED on render (no justification gate)", () => {
    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: /Confirmar Cierre/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("On confirm, POSTs to /api/organizations/{slug}/annual-close with only {year}", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fiscalYearId: "fy-2026",
        correlationId: "corr-1",
        status: "CLOSED",
      }),
    } as unknown as Response);

    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Confirmar Cierre/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/organizations/${ORG_SLUG}/annual-close`);
    expect(init).toMatchObject({ method: "POST" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ year: 2026 });
    expect(body).not.toHaveProperty("justification");
  });

  it("On 200 success, shows toast 'Gestión cerrada exitosamente' (voseo) and calls router.refresh", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fiscalYearId: "fy-2026",
        correlationId: "corr-1",
        status: "CLOSED",
      }),
    } as unknown as Response);

    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Confirmar Cierre/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
    expect(mockToastSuccess.mock.calls[0][0]).toMatch(/Gestión cerrada/i);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("On error response, shows toast.error with the server's error message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: "Los asientos del año no cuadran." }),
    } as unknown as Response);

    render(
      <AnnualCloseDialog
        orgSlug={ORG_SLUG}
        year={2026}
        summary={HAPPY_SUMMARY}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Confirmar Cierre/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockToastError.mock.calls[0][0]).toMatch(/no cuadran/i);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
