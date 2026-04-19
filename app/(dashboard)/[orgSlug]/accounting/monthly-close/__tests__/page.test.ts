/**
 * /accounting/monthly-close page — rbac gate tests.
 *
 * Page requires journal:read. On failure, redirect to /${orgSlug}.
 * PR2 migration: replaces requireAuth+requireOrgAccess+requireRole triple chain.
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

vi.mock("@/features/fiscal-periods", () => {
  class FiscalPeriodsService {
    list = mockList;
  }
  return { FiscalPeriodsService };
});

vi.mock("@/components/settings/monthly-close-panel", () => ({
  MonthlyClosePanel: vi.fn().mockReturnValue(null),
}));

import MonthlyClosePage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
});

describe("/accounting/monthly-close — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await MonthlyClosePage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "journal",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await MonthlyClosePage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
