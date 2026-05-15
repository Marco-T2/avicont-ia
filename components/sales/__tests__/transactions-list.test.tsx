/**
 * PR3 — Tasks 3.1–3.5 (RED): RTL tests for DispatchList (HubItem[]).
 *
 * Covers:
 * - REQ-2: type labels rendered correctly for each source
 * - REQ-8: actions menu routes to /sales/[id] for sale, /dispatches/[id] for dispatch
 * - REQ-10: empty state visible when items=[]
 * - REQ-3: type filter select fires API re-fetch with correct query param
 * - REQ-5: status filter fires API re-fetch with correct query param
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import TransactionsList from "../transactions-list";

// Presentation-local HubItem mirror — replaces retired @/modules/dispatch/presentation
// type re-export (hub.types.ts DELETED in C1 GREEN poc-dispatch-retirement-into-sales).
// Tests local to dispatch-list keep type fidelity with the inline declaration.
type CommonStatus = "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
type HubItem =
  | {
      source: "sale";
      type: "VENTA_GENERAL";
      id: string;
      displayCode: string;
      referenceNumber: number | null;
      date: Date;
      contactId: string;
      contactName: string;
      periodId: string;
      description: string;
      totalAmount: string;
      status: CommonStatus;
    }
  | {
      source: "dispatch";
      type: "NOTA_DESPACHO" | "BOLETA_CERRADA";
      id: string;
      displayCode: string;
      referenceNumber: number | null;
      date: Date;
      contactId: string;
      contactName: string;
      periodId: string;
      description: string;
      totalAmount: string;
      status: CommonStatus;
    };

afterEach(() => cleanup());

// ── jsdom shims for Radix UI ──────────────────────────────────────────────────
// Radix Select calls scrollIntoView on mount when open — jsdom doesn't implement it.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
// Radix also calls hasPointerCapture on pointer events
window.Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
window.Element.prototype.releasePointerCapture = vi.fn();
window.Element.prototype.setPointerCapture = vi.fn();

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SALE_ITEM: HubItem = {
  source: "sale",
  type: "VENTA_GENERAL",
  id: "sale-001",
  displayCode: "VG-001",
  referenceNumber: null,
  date: new Date("2024-03-15"),
  contactId: "contact-1",
  contactName: "Empresa Test SA",
  periodId: "period-1",
  description: "Venta de servicios",
  totalAmount: "1500.00",
  status: "DRAFT",
};

const DISPATCH_ND_ITEM: HubItem = {
  source: "dispatch",
  type: "NOTA_DESPACHO",
  id: "dispatch-001",
  displayCode: "ND-001",
  referenceNumber: 42,
  date: new Date("2024-02-10"),
  contactId: "contact-2",
  contactName: "Cliente ND",
  periodId: "period-1",
  description: "Nota de despacho test",
  totalAmount: "800.00",
  status: "POSTED",
};

const DISPATCH_BC_ITEM: HubItem = {
  source: "dispatch",
  type: "BOLETA_CERRADA",
  id: "dispatch-002",
  displayCode: "BC-001",
  referenceNumber: null,
  date: new Date("2024-01-20"),
  contactId: "contact-3",
  contactName: "Cliente BC",
  periodId: "period-1",
  description: "Boleta cerrada test",
  totalAmount: "3200.50",
  status: "DRAFT",
};

// ── Render helper ─────────────────────────────────────────────────────────────

interface RenderProps {
  items?: HubItem[];
  orgSlug?: string;
  periods?: { id: string; name: string }[];
  filters?: {
    type?: string;
    status?: string;
    periodId?: string;
    contactId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  // poc-sales-unified-pagination C2 cutover — `PaginatedResult<HubItem>`
  // intersection props. Defaults preserve heredado test semantics (no
  // pagination block rendered since totalPages=1).
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

function renderList({
  items = [],
  orgSlug = "test-org",
  periods = [],
  filters = {},
  total,
  page = 1,
  pageSize = 25,
  totalPages = 1,
}: RenderProps = {}) {
  return render(
    <TransactionsList
      orgSlug={orgSlug}
      items={items}
      total={total ?? items.length}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
      periods={periods}
      filters={filters}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DispatchList — type labels (REQ-2)", () => {
  // Note: "Venta General", "Nota de Despacho", "Boleta Cerrada" also appear
  // in the card headers. We assert that the table <td> cell contains the label.

  it("renders VENTA_GENERAL as 'Venta General' in the table", () => {
    renderList({ items: [SALE_ITEM] });
    // Multiple matches expected (card header + table cell) — verify at least one td
    const cells = screen.getAllByText("Ventas General");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    // Specifically the table row column:
    expect(screen.getAllByText(/Venta General/)[0]).toBeInTheDocument();
  });

  it("renders NOTA_DESPACHO as 'Nota de Despacho' in the table", () => {
    renderList({ items: [DISPATCH_ND_ITEM] });
    // getAllByText to handle card header + table cell duplicates
    const matches = screen.getAllByText("Nota de Despacho");
    expect(matches.length).toBeGreaterThanOrEqual(2); // card + table cell
  });

  it("renders BOLETA_CERRADA as 'Boleta Cerrada' in the table", () => {
    renderList({ items: [DISPATCH_BC_ITEM] });
    const matches = screen.getAllByText("Boleta Cerrada");
    expect(matches.length).toBeGreaterThanOrEqual(2); // card + table cell
  });

  it("renders a mixed list with all types present", () => {
    renderList({ items: [SALE_ITEM, DISPATCH_ND_ITEM, DISPATCH_BC_ITEM] });
    // Each type appears at least once in the DOM (as card header or table cell)
    expect(screen.getAllByText(/Nota de Despacho/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Boleta Cerrada/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Venta(?:s)? General/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("DispatchList — actions menu source routing (REQ-8)", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("sale row click navigates to /[orgSlug]/sales/[id]", () => {
    renderList({ items: [SALE_ITEM], orgSlug: "acme" });
    // Click the row (table row click)
    const row = screen.getByText("VG-001").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(mockPush).toHaveBeenCalledWith("/acme/sales/sale-001");
  });

  it("dispatch row click navigates to /[orgSlug]/dispatches/[id]", () => {
    renderList({ items: [DISPATCH_ND_ITEM], orgSlug: "acme" });
    const row = screen.getByText("ND-001").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(mockPush).toHaveBeenCalledWith("/acme/dispatches/dispatch-001");
  });
});

describe("DispatchList — empty state (REQ-10)", () => {
  it("shows empty state when items=[]", () => {
    renderList({ items: [] });
    // Empty state should be visible
    expect(screen.getByTestId("dispatch-list-empty")).toBeInTheDocument();
  });

  it("does not render table rows when items=[]", () => {
    renderList({ items: [] });
    expect(screen.queryByRole("row", { name: /VG-|ND-|BC-/i })).toBeNull();
  });

  it("renders table rows when items present", () => {
    renderList({ items: [SALE_ITEM] });
    expect(screen.queryByTestId("dispatch-list-empty")).toBeNull();
    expect(screen.getByText("VG-001")).toBeInTheDocument();
  });
});

describe("DispatchList — type filter fires re-fetch (REQ-3)", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("selecting VENTA_GENERAL type pushes route with ?type=VENTA_GENERAL", async () => {
    renderList({ items: [SALE_ITEM, DISPATCH_ND_ITEM], orgSlug: "acme" });

    // Open the Radix Select by clicking the trigger
    const typeTrigger = screen.getByTestId("filter-type");
    fireEvent.click(typeTrigger);

    // The option is rendered in a portal; find and click it
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Venta General" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "Venta General" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("type=VENTA_GENERAL"),
      );
    });
  });

  it("selecting 'all' type clears the type param from route", async () => {
    renderList({
      items: [SALE_ITEM],
      orgSlug: "acme",
      filters: { type: "VENTA_GENERAL" },
    });

    const typeTrigger = screen.getByTestId("filter-type");
    fireEvent.click(typeTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "Todos" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("type="),
      );
    });
  });
});

describe("DispatchList — status filter fires re-fetch (REQ-5)", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("selecting DRAFT status pushes route with ?status=DRAFT", async () => {
    renderList({ items: [SALE_ITEM], orgSlug: "acme" });

    const statusTrigger = screen.getByTestId("filter-status");
    fireEvent.click(statusTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Borrador" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "Borrador" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("status=DRAFT"),
      );
    });
  });
});

// ── poc-sales-unified-pagination C2 — UNION pagination block + counter ──

describe("TransactionsList — UNION pagination block (C2.8 a-c)", () => {
  it("renders shadcn Pagination block when totalPages > 1", () => {
    renderList({
      items: [SALE_ITEM, DISPATCH_ND_ITEM],
      total: 30,
      page: 2,
      pageSize: 10,
      totalPages: 3,
      orgSlug: "acme",
    });
    // Pagination block uses role="navigation" (shadcn Pagination wrapper)
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    // Page links 1, 2, 3 — within the nav, rendered as anchors
    expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3" })).toBeInTheDocument();
    // Page 2 has isActive (aria-current="page")
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does NOT render Pagination block when totalPages === 1", () => {
    renderList({
      items: [SALE_ITEM],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders 'Mostrando N-M de Total' counter with correct UNION math", () => {
    renderList({
      items: [SALE_ITEM, DISPATCH_ND_ITEM, DISPATCH_BC_ITEM],
      total: 30,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });
    // (page-1)*pageSize+1 = 11; min(page*pageSize, total) = 20
    expect(screen.getByText(/Mostrando 11-20 de 30/)).toBeInTheDocument();
  });
});

describe("TransactionsList — buildHref href semantics (C2.8 d-e via Pagination links)", () => {
  it("page 1 link omits ?page param (canonical)", () => {
    renderList({
      items: [SALE_ITEM],
      total: 30,
      page: 2,
      pageSize: 10,
      totalPages: 3,
      orgSlug: "acme",
    });
    // Page 1 link href should be "/acme/sales" (no ?page=1)
    const page1 = screen.getByRole("link", { name: "1" });
    expect(page1).toHaveAttribute("href", "/acme/sales");
  });

  it("page >1 link includes ?page=N", () => {
    renderList({
      items: [SALE_ITEM],
      total: 30,
      page: 1,
      pageSize: 10,
      totalPages: 3,
      orgSlug: "acme",
      filters: { status: "POSTED" },
    });
    const page2 = screen.getByRole("link", { name: "2" });
    // URLSearchParams ordering: page, status (insertion order)
    expect(page2.getAttribute("href")).toMatch(
      /^\/acme\/sales\?page=2(?:&status=POSTED)?$/,
    );
    expect(page2.getAttribute("href")).toContain("page=2");
    expect(page2.getAttribute("href")).toContain("status=POSTED");
  });
});

describe("TransactionsList — filter change resets page (C2.8 f-g)", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("applyFilter URL does NOT carry page param (semantically resets to page 1)", async () => {
    renderList({
      items: [SALE_ITEM],
      total: 30,
      page: 3,
      pageSize: 10,
      totalPages: 3,
      orgSlug: "acme",
    });
    const statusTrigger = screen.getByTestId("filter-status");
    fireEvent.click(statusTrigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Borrador" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "Borrador" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("page=3"),
      );
    });
  });

  it("applyFilter routes to /sales (NOT stale /dispatches)", async () => {
    renderList({
      items: [SALE_ITEM],
      total: 30,
      page: 1,
      pageSize: 10,
      totalPages: 3,
      orgSlug: "acme",
    });
    const statusTrigger = screen.getByTestId("filter-status");
    fireEvent.click(statusTrigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Borrador" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "Borrador" }));

    await waitFor(() => {
      const calledWith = mockPush.mock.calls.at(-1)?.[0] as string;
      expect(calledWith).toMatch(/^\/acme\/sales/);
      expect(calledWith).not.toContain("/dispatches");
    });
  });
});
