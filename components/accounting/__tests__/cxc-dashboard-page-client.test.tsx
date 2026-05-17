/**
 * RED — CxcDashboardPageClient contract (C6d).
 *
 * Sister parity: contact-ledger-page-client clone shape adapted to the
 * dashboard surface (tabla server-paginated, no client filter form).
 *
 * Cases (mirror spec REQ "Contact Dashboard"):
 *   T1 — renders table with columns Nombre, Fecha último mov, Total Bs, Ver
 *   T2 — default checkbox "Solo con saldo" checked (includeZeroBalance=false)
 *   T3 — toggling "Mostrar todos" → router.push with includeZeroBalance=true
 *   T4 — click "Ver" link → href `/{orgSlug}/accounting/cxc/{contactId}`
 *   T5 — sort default openBalance desc (visual hint on header)
 *   T6 — click "Total Bs" header → router.push con sort=openBalance & dir toggle
 *   T7 — empty state cuando items.length === 0
 *   T8 — pagination component renders cuando totalPages > 1
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]: the
 * component file `../cxc-dashboard-page-client.tsx` does NOT exist yet.
 * Vitest fails at import resolution. C6d GREEN ships the component +
 * sister `cxp-dashboard-page-client.tsx` + replaces RSC pages.
 */

import { render, screen, within, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const ORG_SLUG = "test-org";

type DashboardRow = {
  contactId: string;
  name: string;
  lastMovementDate: string | null;
  openBalance: string;
};

type Dashboard = {
  items: DashboardRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const sampleItems: DashboardRow[] = [
  {
    contactId: "c-1",
    name: "Acme SA",
    lastMovementDate: "2025-01-20T00:00:00.000Z",
    openBalance: "1500.50",
  },
  {
    contactId: "c-2",
    name: "Beta SRL",
    lastMovementDate: "2025-01-15T00:00:00.000Z",
    openBalance: "300.00",
  },
];

import CxcDashboardPageClient from "../cxc-dashboard-page-client";

afterEach(() => {
  cleanup();
  mockPush.mockClear();
});

describe("CxcDashboardPageClient", () => {
  function renderClient(over: Partial<{
    dashboard: Dashboard;
    filters: {
      includeZeroBalance?: boolean;
      page?: number;
      pageSize?: number;
      sort?: "openBalance" | "name" | "lastMovementDate";
      direction?: "asc" | "desc";
    };
  }> = {}) {
    const dashboard: Dashboard = over.dashboard ?? {
      items: sampleItems,
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };
    return render(
      <CxcDashboardPageClient
        orgSlug={ORG_SLUG}
        dashboard={dashboard}
        filters={over.filters ?? {}}
      />,
    );
  }

  it("T1 — renders table with Nombre, Fecha último mov, Total Bs, Ver columns", () => {
    renderClient();
    expect(screen.getByRole("columnheader", { name: /nombre/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /fecha.*movimiento/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /total.*bs/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /ver/i })).toBeInTheDocument();
  });

  it("T2 — default 'Solo con saldo' checkbox is checked (includeZeroBalance=false)", () => {
    renderClient();
    const cb = screen.getByRole("checkbox", { name: /solo con saldo/i });
    expect(cb).toBeChecked();
  });

  it("T3 — toggling 'Solo con saldo' off pushes includeZeroBalance=true", () => {
    renderClient();
    const cb = screen.getByRole("checkbox", { name: /solo con saldo/i });
    fireEvent.click(cb);
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0]![0] as string;
    expect(arg).toContain("includeZeroBalance=true");
  });

  it("T4 — Ver link href = /{orgSlug}/accounting/cxc/{contactId}", () => {
    renderClient();
    const link = screen.getByRole("link", { name: /ver.*acme/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(`/${ORG_SLUG}/accounting/cxc/c-1`);
  });

  it("T5 — Total Bs header has data-sort='desc' default", () => {
    renderClient();
    const totalHeader = screen.getByRole("columnheader", { name: /total.*bs/i });
    expect(totalHeader.getAttribute("data-sort-active")).toBe("true");
    expect(totalHeader.getAttribute("data-sort-direction")).toBe("desc");
  });

  it("T6 — click Total Bs header → router.push with sort=openBalance & direction toggled", () => {
    renderClient({ filters: { sort: "openBalance", direction: "desc" } });
    const totalHeader = screen.getByRole("columnheader", { name: /total.*bs/i });
    const btn = within(totalHeader).getByRole("button");
    fireEvent.click(btn);
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0]![0] as string;
    expect(arg).toContain("sort=openBalance");
    expect(arg).toContain("direction=asc");
  });

  it("T7 — empty state cuando items.length === 0", () => {
    renderClient({
      dashboard: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
    });
    expect(screen.getByText(/no hay contactos/i)).toBeInTheDocument();
  });

  it("T8 — pagination renders cuando totalPages > 1", () => {
    renderClient({
      dashboard: {
        items: sampleItems,
        total: 30,
        page: 1,
        pageSize: 20,
        totalPages: 2,
      },
    });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
