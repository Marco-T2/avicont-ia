/**
 * /accounting/accounts page — rbac gate tests.
 *
 * Page requires accounting-config:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockGetTree,
  mockList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetTree: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/accounting", () => {
  class AccountsService {
    getTree = mockGetTree;
    list = mockList;
  }
  return { AccountsService };
});

vi.mock("@/components/accounting/accounts-page-client", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import AccountsPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTree.mockResolvedValue([]);
  mockList.mockResolvedValue([]);
});

describe("/accounting/accounts — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await AccountsPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await AccountsPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
