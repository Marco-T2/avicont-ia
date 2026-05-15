/**
 * /informes page — rbac gate tests + C0 per-entry RBAC filter.
 *
 * Page requires reports:read at the entry-gate. After the gate, the page
 * pre-resolves a per-entry RBAC filter via `canAccess(role, entry.resource, "read", orgId)`
 * and passes the filtered list to <CatalogPage entries={...} />. On gate
 * failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockCanAccess, mockCatalogPage } =
  vi.hoisted(() => ({
    mockRedirect: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockCanAccess: vi.fn(),
    mockCatalogPage: vi.fn().mockReturnValue(null),
  }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
  canAccess: mockCanAccess,
}));

vi.mock("@/components/reports/catalog-page", () => ({
  CatalogPage: mockCatalogPage,
}));

import InformesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: full access (canAccess returns true for every resource)
  mockCanAccess.mockResolvedValue(true);
});

describe("/informes — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({
      session: {},
      orgId: "org-1",
      role: "owner",
    });

    await InformesPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await InformesPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});

describe("/informes — C0 per-entry RBAC filter", () => {
  beforeEach(() => {
    mockRequirePermission.mockResolvedValue({
      session: {},
      orgId: "org-1",
      role: "cobrador",
    });
  });

  it("passes filtered `entries` prop to <CatalogPage>; CxP excluded when purchases denied", async () => {
    // cobrador: sales OK, purchases DENIED, reports OK, etc.
    mockCanAccess.mockImplementation(
      async (_role: string, resource: string) => {
        if (resource === "purchases") return false;
        return true;
      },
    );

    await InformesPage({ params: makeParams() });

    // CatalogPage mock must have been called with an `entries` prop
    expect(mockCatalogPage).toHaveBeenCalled();
    const props = mockCatalogPage.mock.calls[0]![0] as {
      orgSlug: string;
      entries: ReadonlyArray<{ id: string; resource?: string }>;
    };
    expect(props.orgSlug).toBe(ORG_SLUG);
    expect(Array.isArray(props.entries)).toBe(true);

    // CxP (resource=purchases) MUST be filtered out
    const cxpEntry = props.entries.find((e) => e.id === "cuentas-por-pagar");
    expect(cxpEntry).toBeUndefined();

    // CxC (resource=sales) MUST be present
    const cxcEntry = props.entries.find((e) => e.id === "cuentas-por-cobrar");
    expect(cxcEntry).toBeDefined();
  });

  it("entries without a resource are always passed through (back-compat)", async () => {
    // Deny EVERY resource
    mockCanAccess.mockResolvedValue(false);

    await InformesPage({ params: makeParams() });

    const props = mockCatalogPage.mock.calls[0]![0] as {
      entries: ReadonlyArray<{ id: string; resource?: string }>;
    };

    // Entries WITHOUT resource (e.g., worksheet) survive deny-all
    const worksheet = props.entries.find((e) => e.id === "worksheet");
    expect(worksheet).toBeDefined();
  });
});
