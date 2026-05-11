/**
 * /dispatches page — rbac gate tests.
 *
 * Page requires sales:read (NOT dispatches — per resource-nav-mapping-fix
 * archive #756 DCSN-001 and REQ-PG.7 of rbac-page-gating).
 * On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockListHub,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListHub: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/dispatch/presentation/server", () => {
  class HubService {
    listHub = mockListHub;
  }
  class DispatchService {}
  return { HubService, DispatchService };
});

// vi.mock("@/features/sale/server") REMOVED en A3-C7 GREEN (mock_hygiene_commit_scope
// MEMORY.md): DEAD-MOCK post A3-C5 cutover — page.tsx:4 importa `makeSaleService`
// desde `@/modules/sale/presentation/composition-root` (hex), NO importa de
// `@/features/sale/server`. Path siendo deleted A3-C7 GREEN sub-pasos 1-19
// (features/sale/ wholesale removal). Sub-paso 20 atomic batch.

vi.mock("@/components/dispatches/dispatch-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import DispatchesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({} as Record<string, string | string[] | undefined>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListHub.mockResolvedValue({ items: [] });
});

describe("/dispatches — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await DispatchesPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await DispatchesPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
