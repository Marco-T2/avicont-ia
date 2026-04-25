/**
 * /accounting/financial-statements/balance-sheet page — rbac gate tests.
 *
 * Page requires reports:read. On failure, redirect to /${orgSlug}.
 * PR2 migration: replaces requireAuth+requireOrgAccess+requireRole triple chain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockGetOrCreate } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetOrCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/org-profile/server", () => ({
  OrgProfileService: class {
    getOrCreate = mockGetOrCreate;
  },
}));

vi.mock("@/components/financial-statements/balance-sheet-page-client", () => ({
  BalanceSheetPageClient: vi.fn().mockReturnValue(null),
}));

import BalanceSheetPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreate.mockResolvedValue({ razonSocial: "" });
});

describe("/accounting/financial-statements/balance-sheet — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await BalanceSheetPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await BalanceSheetPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
