/**
 * /accounting/journal/[entryId] page — rbac gate tests.
 *
 * Page requires journal:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockNotFound,
  mockRequirePermission,
  mockGetById,
  mockPeriodsList,
  mockVoucherTypesList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetById: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockVoucherTypesList: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/accounting", () => {
  class JournalService {
    getById = mockGetById;
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

vi.mock("@/components/accounting/journal-entry-detail", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import EntryDetailPage from "../page";

const ORG_SLUG = "acme";
const ENTRY_ID = "entry-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, entryId: ENTRY_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetById.mockResolvedValue({
    id: ENTRY_ID,
    periodId: "p-1",
    voucherTypeId: "vt-1",
  });
  mockPeriodsList.mockResolvedValue([]);
  mockVoucherTypesList.mockResolvedValue([]);
});

describe("/accounting/journal/[entryId] — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await EntryDetailPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "journal",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await EntryDetailPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
