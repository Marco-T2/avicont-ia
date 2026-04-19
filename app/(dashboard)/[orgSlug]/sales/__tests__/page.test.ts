/**
 * /sales page — rbac gate tests.
 *
 * Page requires sales:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockList } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/sale", () => {
  class SaleService {
    list = mockList;
  }
  return { SaleService };
});

vi.mock("@/components/sales/sale-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import SalesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
});

describe("/sales — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await SalesPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await SalesPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
