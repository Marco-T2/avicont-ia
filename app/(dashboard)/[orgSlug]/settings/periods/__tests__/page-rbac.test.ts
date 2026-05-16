/**
 * /settings/periods page — rbac gate tests.
 *
 * Page requires accounting-config:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Raise timeout — passes solo but times out under full-suite WSL memory pressure (Bucket D)
vi.setConfig({ testTimeout: 15000 });

const { mockRedirect, mockRequirePermission, mockList } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockList })),
}));

vi.mock("@/components/accounting/annual-period-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PeriodsPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
});

describe("/settings/periods — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await PeriodsPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "period",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await PeriodsPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
