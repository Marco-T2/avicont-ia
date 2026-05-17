/**
 * /accounting/cxc page — rbac gate tests (C6 refactor).
 *
 * Page requires sales:read. On failure, redirect to /${orgSlug}.
 *
 * C6 change: the page surface flipped from a ReceivableList legacy load to
 * a CxC contact-balances dashboard load (design D5). Mocks updated per
 * [[mock_hygiene_commit_scope]] + [[cross_module_boundary_mock_target_rewrite]].
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockListContactsWithOpenBalance,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListContactsWithOpenBalance: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/contact-balances/presentation/server", () => ({
  makeContactBalancesService: () => ({
    listContactsWithOpenBalance: mockListContactsWithOpenBalance,
  }),
}));

vi.mock("@/components/accounting/cxc-dashboard-page-client", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import CxCPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams(sp: Record<string, string> = {}) {
  return Promise.resolve(sp);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListContactsWithOpenBalance.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
});

describe("/accounting/cxc — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await CxCPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockListContactsWithOpenBalance).toHaveBeenCalledWith(
      "org-1",
      "CLIENTE",
      expect.any(Object),
    );
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await CxCPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
