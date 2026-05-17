/**
 * RED — CxpDashboardPageClient contract (C6d).
 *
 * Sister of cxc-dashboard-page-client.test.tsx — same surface, target
 * `/{orgSlug}/accounting/cxp/{contactId}` para Ver action (PROVEEDOR).
 *
 * Cases:
 *   T1 — renders table with Nombre, Fecha último mov, Total Bs, Ver
 *   T2 — Ver link href = /{orgSlug}/accounting/cxp/{contactId}
 *   T3 — toggle "Solo con saldo" off pushes includeZeroBalance=true
 *   T4 — empty state cuando items.length === 0
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 * component file `../cxp-dashboard-page-client.tsx` does NOT exist yet.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const ORG_SLUG = "test-org";

const sampleItems = [
  {
    contactId: "p-1",
    name: "Proveedor Alpha",
    lastMovementDate: "2025-01-10T00:00:00.000Z",
    openBalance: "800.00",
  },
];

import CxpDashboardPageClient from "../cxp-dashboard-page-client";

afterEach(() => {
  cleanup();
  mockPush.mockClear();
});

describe("CxpDashboardPageClient", () => {
  function renderClient(items = sampleItems) {
    return render(
      <CxpDashboardPageClient
        orgSlug={ORG_SLUG}
        dashboard={{
          items,
          total: items.length,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }}
        filters={{}}
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

  it("T2 — Ver link href = /{orgSlug}/accounting/cxp/{contactId}", () => {
    renderClient();
    const link = screen.getByRole("link", { name: /ver.*proveedor alpha/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(`/${ORG_SLUG}/accounting/cxp/p-1`);
  });

  it("T3 — toggling 'Solo con saldo' off pushes includeZeroBalance=true", () => {
    renderClient();
    const cb = screen.getByRole("checkbox", { name: /solo con saldo/i });
    fireEvent.click(cb);
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0]![0] as string;
    expect(arg).toContain("includeZeroBalance=true");
  });

  it("T4 — empty state cuando items.length === 0", () => {
    renderClient([]);
    expect(screen.getByText(/no hay contactos/i)).toBeInTheDocument();
  });
});
