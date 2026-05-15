/**
 * /accounting/journal page — rbac gate tests.
 *
 * Page requires journal:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockListPaginated,
  mockPeriodsList,
  mockVoucherTypesList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListPaginated: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockVoucherTypesList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/accounting/presentation/server")
  >();
  return {
    ...actual,
    makeJournalsService: vi.fn(() => ({ listPaginated: mockListPaginated })),
  };
});

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockPeriodsList })),
}));

vi.mock("@/modules/voucher-types/presentation/server", () => ({
  makeVoucherTypesService: () => ({ list: mockVoucherTypesList }),
}));

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
  mockListPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
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
