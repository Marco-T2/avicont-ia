/**
 * /informes page — rbac gate tests + C0 per-entry RBAC filter.
 *
 * Page requires reports:read at the entry-gate. After the gate, the page
 * pre-resolves a per-entry RBAC filter via `canAccess(role, entry.resource, "read", orgId)`
 * and passes the filtered list to <CatalogPage entries={...} />. On gate
 * failure, redirect to /${orgSlug}.
 *
 * Note: the page is a Server Component that returns JSX. We do NOT render it;
 * we inspect the returned React element tree to find the <CatalogPage /> child
 * and read its props.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

const { mockRedirect, mockRequirePermission, mockCanAccess, CatalogPageMock } =
  vi.hoisted(() => ({
    mockRedirect: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockCanAccess: vi.fn(),
    CatalogPageMock: vi.fn().mockReturnValue(null),
  }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
  canAccess: mockCanAccess,
}));

vi.mock("@/components/reports/catalog-page", () => ({
  CatalogPage: CatalogPageMock,
}));

import InformesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

/**
 * Walk the returned ReactElement tree, find the element whose `type` is the
 * mocked CatalogPage, and return its props. Returns `null` if not found.
 */
type CatalogPageProps = {
  orgSlug: string;
  entries: ReadonlyArray<{ id: string; resource?: string }>;
};

function findCatalogPageProps(
  node: unknown,
): CatalogPageProps | null {
  if (!node || typeof node !== "object") return null;
  // ReactElement
  const el = node as ReactElement;
  if (
    "type" in el &&
    el.type === (CatalogPageMock as unknown as ReactElement["type"])
  ) {
    return el.props as CatalogPageProps;
  }
  if ("props" in el) {
    const children = (el.props as { children?: unknown })?.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        const found = findCatalogPageProps(child);
        if (found) return found;
      }
    } else if (children) {
      return findCatalogPageProps(children);
    }
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: full access (canAccess returns true for every resource)
  mockCanAccess.mockResolvedValue(true);
  // Restore the mocked CatalogPage's return after clearAllMocks
  CatalogPageMock.mockReturnValue(null);
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

    const tree = await InformesPage({ params: makeParams() });
    const props = findCatalogPageProps(tree);
    expect(props).not.toBeNull();
    expect(props!.orgSlug).toBe(ORG_SLUG);
    expect(Array.isArray(props!.entries)).toBe(true);

    // CxP (resource=purchases) MUST be filtered out
    const cxpEntry = props!.entries.find((e) => e.id === "cuentas-por-pagar");
    expect(cxpEntry).toBeUndefined();

    // CxC (resource=sales) MUST be present
    const cxcEntry = props!.entries.find((e) => e.id === "cuentas-por-cobrar");
    expect(cxcEntry).toBeDefined();
  });

  it("entries without a resource are always passed through (back-compat)", async () => {
    // Deny EVERY resource
    mockCanAccess.mockResolvedValue(false);

    const tree = await InformesPage({ params: makeParams() });
    const props = findCatalogPageProps(tree);
    expect(props).not.toBeNull();

    // Entries WITHOUT resource (e.g., worksheet) survive deny-all
    const worksheet = props!.entries.find((e) => e.id === "worksheet");
    expect(worksheet).toBeDefined();
  });
});
