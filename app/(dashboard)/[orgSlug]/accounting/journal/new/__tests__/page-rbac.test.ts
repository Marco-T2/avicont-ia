/**
 * /accounting/journal/new page — rbac gate tests.
 *
 * Page requires journal:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockAccountsList,
  mockPeriodsList,
  mockVoucherTypesList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockAccountsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockVoucherTypesList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/accounting/server", () => {
  class AccountsService {
    list = mockAccountsList;
  }
  return { AccountsService };
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

vi.mock("@/components/accounting/journal-entry-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import NewJournalEntryPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAccountsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockVoucherTypesList.mockResolvedValue([]);
});

describe("/accounting/journal/new — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await NewJournalEntryPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "journal",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await NewJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
