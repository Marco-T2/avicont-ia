/**
 * /accounting/journal page — rbac gate tests.
 *
 * Page requires journal:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockJournalList,
  mockPeriodsList,
  mockVoucherTypesList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournalList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockVoucherTypesList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/accounting/server", () => {
  class JournalService {
    list = mockJournalList;
  }
  return { JournalService };
});

vi.mock("@/features/fiscal-periods/server", () => {
  class FiscalPeriodsService {
    list = mockPeriodsList;
  }
  return { FiscalPeriodsService };
});

vi.mock("@/features/voucher-types/server", () => {
  class VoucherTypesService {
    list = mockVoucherTypesList;
  }
  return { VoucherTypesService };
});

vi.mock("@/components/accounting/journal-entry-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import JournalPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({} as Record<string, string | string[] | undefined>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockJournalList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockVoucherTypesList.mockResolvedValue([]);
});

describe("/accounting/journal — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await JournalPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "journal",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await JournalPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
