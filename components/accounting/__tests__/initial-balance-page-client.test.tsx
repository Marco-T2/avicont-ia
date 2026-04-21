/**
 * T20b — RED: InitialBalancePageClient component tests.
 *
 * Asserts:
 * (a) Mocks global fetch for `/api/organizations/{orgSlug}/initial-balance?format=json`
 *     returning a fixture statement; asserts the view renders with fetched data.
 * (b) Clicking "Export PDF" button triggers a fetch to `?format=pdf`
 *     AND a blob download via `URL.createObjectURL` (mocked).
 * (c) Clicking "Export XLSX" button triggers a fetch to `?format=xlsx`
 *     AND a blob download via `URL.createObjectURL`.
 *
 * Fails because `components/accounting/initial-balance-page-client.tsx` does not exist yet.
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

const mockCreateObjectURL = vi.fn(() => "blob:fake-url");
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// ── Fixture ───────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

const FIXTURE_STATEMENT = {
  orgId: "org-1",
  dateAt: "2025-01-01T00:00:00.000Z",
  sections: [
    {
      key: "ACTIVO",
      label: "ACTIVO",
      groups: [
        {
          subtype: "CURRENT",
          label: "Activo Corriente",
          rows: [
            { accountId: "acc-1", code: "1.1.01", name: "Caja", amount: "5000.00" },
          ],
          subtotal: "5000.00",
        },
      ],
      sectionTotal: "5000.00",
    },
    {
      key: "PASIVO_PATRIMONIO",
      label: "PASIVO Y PATRIMONIO",
      groups: [
        {
          subtype: "CAPITAL_SOCIAL",
          label: "Capital Social",
          rows: [
            { accountId: "acc-5", code: "3.1.01", name: "Capital Social", amount: "5000.00" },
          ],
          subtotal: "5000.00",
        },
      ],
      sectionTotal: "5000.00",
    },
  ],
  imbalanced: false,
  imbalanceDelta: "0",
  multipleCA: false,
  caCount: 1,
};

const FAKE_BLOB = new Blob(["%PDF-fake"], { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();

  mockFetch.mockImplementation((url: string) => {
    const urlStr = String(url);
    if (urlStr.includes("format=json")) {
      return Promise.resolve({
        ok: true,
        json: async () => FIXTURE_STATEMENT,
      });
    }
    // PDF or XLSX export
    return Promise.resolve({
      ok: true,
      blob: async () => FAKE_BLOB,
    });
  });

  mockCreateObjectURL.mockReturnValue("blob:fake-url");
});

afterEach(() => cleanup());

// ── Import after mocks ────────────────────────────────────────────────────────

import { InitialBalancePageClient } from "../initial-balance-page-client";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InitialBalancePageClient", () => {
  it("(a) fetches ?format=json on mount and renders view with statement data", async () => {
    render(<InitialBalancePageClient orgSlug={ORG_SLUG} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/organizations/${ORG_SLUG}/initial-balance`),
        expect.anything(),
      );
    });

    // Verify the fetch URL includes format=json
    const fetchCalls = mockFetch.mock.calls;
    const jsonCall = fetchCalls.find((args: unknown[]) =>
      String(args[0]).includes("format=json"),
    );
    expect(jsonCall).toBeDefined();

    // View should render with fixture data
    await waitFor(() => {
      expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    });
    expect(screen.getByText("PASIVO Y PATRIMONIO")).toBeInTheDocument();
    expect(screen.getByText("Caja")).toBeInTheDocument();
  });

  it("(b) clicking Export PDF button fetches ?format=pdf and triggers blob download", async () => {
    render(<InitialBalancePageClient orgSlug={ORG_SLUG} />);

    // Wait for initial JSON fetch + view to render
    await waitFor(() => {
      expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    });

    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, blob: async () => FAKE_BLOB });
    mockCreateObjectURL.mockReturnValue("blob:fake-url");

    const pdfButton = screen.getByRole("button", { name: /export.*pdf|pdf/i });
    fireEvent.click(pdfButton);

    await waitFor(() => {
      const pdfCall = mockFetch.mock.calls.find((args: unknown[]) =>
        String(args[0]).includes("format=pdf"),
      );
      expect(pdfCall).toBeDefined();
    });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });
  });

  it("(c) clicking Export XLSX button fetches ?format=xlsx and triggers blob download", async () => {
    const xlsxBlob = new Blob(["fake-xlsx"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(<InitialBalancePageClient orgSlug={ORG_SLUG} />);

    await waitFor(() => {
      expect(screen.getByText("ACTIVO")).toBeInTheDocument();
    });

    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, blob: async () => xlsxBlob });
    mockCreateObjectURL.mockReturnValue("blob:fake-url");

    const xlsxButton = screen.getByRole("button", { name: /export.*xlsx|export.*excel|xlsx|excel/i });
    fireEvent.click(xlsxButton);

    await waitFor(() => {
      const xlsxCall = mockFetch.mock.calls.find((args: unknown[]) =>
        String(args[0]).includes("format=xlsx"),
      );
      expect(xlsxCall).toBeDefined();
    });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });
  });
});
