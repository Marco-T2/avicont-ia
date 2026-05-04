/**
 * /accounting/correlation-audit page — rbac gate tests.
 *
 * Page requires journal:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockVoucherTypesList } =
  vi.hoisted(() => ({
    mockRedirect: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockVoucherTypesList: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/voucher-types/presentation/server", () => ({
  makeVoucherTypesService: () => ({ list: mockVoucherTypesList }),
}));

vi.mock("@/components/accounting/correlation-audit-view", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import CorrelationAuditPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVoucherTypesList.mockResolvedValue([]);
});

describe("/accounting/correlation-audit — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await CorrelationAuditPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "journal",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await CorrelationAuditPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
