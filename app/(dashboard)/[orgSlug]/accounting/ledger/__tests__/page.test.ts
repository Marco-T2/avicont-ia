/**
 * /accounting/ledger page — rbac gate + RSC twin-call tests.
 *
 * Page requires journal:read. On failure, redirect to /${orgSlug}.
 *
 * RSC twin-call (poc-pagination-ledger C3): page.tsx awaits searchParams
 * and Promise.all([accountsService.list(orgId), accountId ?
 * ledgerService.getAccountLedgerPaginated(orgId, accountId, dateRange,
 * periodId, pagination) : Promise.resolve(null)]).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockList,
  mockGetAccountLedgerPaginated,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockList: vi.fn(),
  mockGetAccountLedgerPaginated: vi.fn(),
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
    makeAccountsService: () => ({ list: mockList }),
    makeLedgerService: () => ({
      getAccountLedgerPaginated: mockGetAccountLedgerPaginated,
    }),
  };
});

vi.mock("@/components/accounting/ledger-page-client", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import LedgerPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams(
  sp: Record<string, string | string[] | undefined> = {},
) {
  return Promise.resolve(sp);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
  mockGetAccountLedgerPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    openingBalance: "0.00",
  });
});

describe("/accounting/ledger — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await LedgerPage({
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

    await LedgerPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});

describe("/accounting/ledger — RSC twin-call (poc-pagination-ledger C3)", () => {
  beforeEach(() => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
  });

  it("calls getAccountLedgerPaginated with parsed pagination when accountId present (SC-7)", async () => {
    await LedgerPage({
      params: makeParams(),
      searchParams: makeSearchParams({
        accountId: "acc-1",
        page: "2",
        pageSize: "25",
      }),
    });

    expect(mockGetAccountLedgerPaginated).toHaveBeenCalledTimes(1);
    const args = mockGetAccountLedgerPaginated.mock.calls[0];
    expect(args[0]).toBe("org-1");
    expect(args[1]).toBe("acc-1");
    // pagination = 5th arg
    expect(args[4]).toEqual(
      expect.objectContaining({ page: 2, pageSize: 25 }),
    );
  });

  it("skips ledger fetch when accountId absent (accounts still fetched)", async () => {
    await LedgerPage({
      params: makeParams(),
      searchParams: makeSearchParams({}),
    });

    expect(mockGetAccountLedgerPaginated).not.toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledWith("org-1");
  });
});
