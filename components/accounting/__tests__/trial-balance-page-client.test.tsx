/**
 * B8 — RED: TrialBalancePageClient component tests.
 *
 * Asserts:
 * (a) Renders date filter form on initial render.
 * (b) Renders TrialBalanceTable after successful data fetch.
 * (c) Renders PDF + XLSX download buttons when data is available.
 * (d) Shows error message when API returns non-ok response.
 *
 * Covers C9.S2 (filter wired), C9.S3 (export buttons).
 */

import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeZero() { return "0.00"; }

const MINIMAL_REPORT = {
  orgId: "org-1",
  dateFrom: "2025-01-01T00:00:00.000Z",
  dateTo: "2025-12-31T00:00:00.000Z",
  rows: [],
  totals: {
    sumasDebe: makeZero(),
    sumasHaber: makeZero(),
    saldoDeudor: makeZero(),
    saldoAcreedor: makeZero(),
  },
  imbalanced: false,
  deltaSumas: makeZero(),
  deltaSaldos: makeZero(),
};

const ORG_SLUG = "test-org";

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => MINIMAL_REPORT,
  });
});

afterEach(() => cleanup());

// ── Import after mocks ────────────────────────────────────────────────────────

import { TrialBalancePageClient } from "../trial-balance-page-client";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialBalancePageClient (C9.S2)", () => {
  it("(a) renders date filter inputs on initial render", () => {
    render(<TrialBalancePageClient orgSlug={ORG_SLUG} />);
    expect(screen.getByLabelText(/fecha de inicio|desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha de fin|hasta/i)).toBeInTheDocument();
  });

  it("(b) renders TrialBalanceTable after successful fetch", async () => {
    render(<TrialBalancePageClient orgSlug={ORG_SLUG} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|hasta/i);

    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const form = dateFromInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("TOTAL")).toBeInTheDocument();
    });
  });

  it("(c) renders PDF + XLSX download buttons after fetch", async () => {
    render(<TrialBalancePageClient orgSlug={ORG_SLUG} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|hasta/i);

    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const form = dateFromInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/descargar pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/descargar excel/i)).toBeInTheDocument();
    });
  });

  it("(d) shows error when API returns non-ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Error de prueba" }),
    });

    render(<TrialBalancePageClient orgSlug={ORG_SLUG} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|hasta/i);

    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const form = dateFromInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
