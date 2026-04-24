/**
 * /accounting/financial-statements/income-statement page — rbac gate tests.
 *
 * Page requires reports:read. On failure, redirect to /${orgSlug}.
 * PR2 migration: replaces requireAuth+requireOrgAccess+requireRole triple chain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/components/financial-statements/income-statement-page-client", () => ({
  IncomeStatementPageClient: vi.fn().mockReturnValue(null),
}));

import IncomeStatementPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/accounting/financial-statements/income-statement — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await IncomeStatementPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await IncomeStatementPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
