/**
 * /accounting/journal/[entryId]/edit page — rbac gate tests (DCSN-007 sibling).
 *
 * Page requires journal:write. On failure, redirect to /${orgSlug}.
 *
 * Separate from page.test.ts (which covers T3.1–T7.9 business-logic guards).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockNotFound,
  mockRequirePermission,
  mockGetById,
  mockPeriodsList,
  mockVoucherTypesList,
  mockAccountsList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetById: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockVoucherTypesList: vi.fn(),
  mockAccountsList: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/accounting/server", () => {
  class JournalService {
    getById = mockGetById;
  }
  class AccountsService {
    list = mockAccountsList;
  }
  return { JournalService, AccountsService };
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

import EditJournalEntryPage from "../page";

const ORG_SLUG = "acme";
const ENTRY_ID = "je-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, entryId: ENTRY_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetById.mockResolvedValue({
    id: ENTRY_ID,
    status: "DRAFT",
    sourceType: null,
    periodId: "p-1",
    date: new Date("2026-01-15"),
    number: 1,
    description: "Test",
    voucherTypeId: "vt-1",
    referenceNumber: null,
    lines: [],
  });
  mockPeriodsList.mockResolvedValue([{ id: "p-1", status: "OPEN" }]);
  mockVoucherTypesList.mockResolvedValue([]);
  mockAccountsList.mockResolvedValue([]);
});

describe("/accounting/journal/[entryId]/edit — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-db-id" });

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "journal",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
