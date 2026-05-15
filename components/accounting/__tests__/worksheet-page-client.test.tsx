/**
 * T29 — RED: WorksheetPageClient component tests.
 *
 * Asserts:
 * (a) Renders WorksheetFilters.
 * (b) Renders WorksheetTable when data is available.
 * (c) Renders PDF + XLSX download buttons when data is available.
 * (d) Shows "Sin asientos de ajuste" note when no CJ data in the period.
 *
 * Covers REQ-10 (filters wired), spec 1.S2.
 */

import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Minimal serialized report fixture ─────────────────────────────────────────

function makeZero() { return "0"; }

const MINIMAL_REPORT = {
  orgId: "org-1",
  dateFrom: "2025-01-01T00:00:00.000Z",
  dateTo: "2025-12-31T00:00:00.000Z",
  groups: [],
  carryOverRow: undefined,
  grandTotals: {
    sumasDebe: makeZero(), sumasHaber: makeZero(),
    saldoDeudor: makeZero(), saldoAcreedor: makeZero(),
    ajustesDebe: makeZero(), ajustesHaber: makeZero(),
    saldoAjDeudor: makeZero(), saldoAjAcreedor: makeZero(),
    resultadosPerdidas: makeZero(), resultadosGanancias: makeZero(),
    bgActivo: makeZero(), bgPasPat: makeZero(),
  },
  imbalanced: false,
  imbalanceDelta: makeZero(),
  oppositeSignAccounts: [],
  allAjustesZero: false,
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

// ── Tests ─────────────────────────────────────────────────────────────────────

import { WorksheetPageClient } from "../worksheet-page-client";

describe("WorksheetPageClient (REQ-10)", () => {
  it("(a) renders WorksheetFilters on initial render", () => {
    render(<WorksheetPageClient orgSlug={ORG_SLUG} />);

    // Should show the date from label (from WorksheetFilters)
    expect(screen.getByLabelText(/fecha de inicio|dateFrom|desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha de fin|dateTo|hasta/i)).toBeInTheDocument();
  });

  it("(b) renders WorksheetTable after data fetch", async () => {
    render(<WorksheetPageClient orgSlug={ORG_SLUG} />);

    // Fill in dates and submit
    const dateFromInput = screen.getByLabelText(/fecha de inicio|dateFrom|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|dateTo|hasta/i);
    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const submitButton = screen.getByRole("button", { name: /generar|calcular|aplicar/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    // WorksheetTable renders a table element
    await waitFor(() => {
      const table = document.querySelector("table");
      expect(table).toBeInTheDocument();
    });
  });

  it("(c) renders PDF and XLSX download links/buttons after data fetch", async () => {
    render(<WorksheetPageClient orgSlug={ORG_SLUG} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|dateFrom|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|dateTo|hasta/i);
    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const submitButton = screen.getByRole("button", { name: /generar|calcular|aplicar/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    await waitFor(() => {
      const pdfLink = screen.queryByText(/pdf/i) ?? screen.queryByText(/PDF/);
      const xlsxLink = screen.queryByText(/excel|xlsx/i);
      expect(pdfLink ?? xlsxLink).toBeInTheDocument();
    });
  });

  it("(d) shows 'sin asientos de ajuste' note when allAjustesZero=true", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...MINIMAL_REPORT, allAjustesZero: true }),
    });

    render(<WorksheetPageClient orgSlug={ORG_SLUG} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|dateFrom|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|dateTo|hasta/i);
    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const submitButton = screen.getByRole("button", { name: /generar|calcular|aplicar/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    await waitFor(() => {
      const note = screen.queryByText(/sin asientos de ajuste|no hay asientos de ajuste|ajuste.*CJ/i);
      expect(note).toBeInTheDocument();
    });
  });
});
