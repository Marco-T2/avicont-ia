/**
 * /purchases page — rbac gate tests.
 *
 * Page requires purchases:read. On failure, redirect to /${orgSlug}.
 *
 * Mocks updated A3-C6a cutover: legacy `@/features/purchase/server`
 * PurchaseService stale post-cutover replaced by hex
 * `@/modules/purchase/presentation/composition-root` makePurchaseService +
 * Prisma direct mocks (contact + fiscalPeriod findMany batch lookups).
 * Mock anomaly absorbed inline GREEN sub-§13 in-flight surface mirror
 * A3-C4a.5 sales/__tests__/page.test.ts precedent. Test semantics RBAC-only
 * preserved (data path empty array — mapper never invoked).
 *
 * POC pagination-replication C1-MACRO Purchase: cascade adapt mismo batch
 * — `mockList` → `mockListPaginated` + searchParams Promise pass +
 * PaginatedResult shape mock (mirror Sale pilot precedent EXACT).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockMakePurchaseService,
  mockListPaginated,
  mockContactFindMany,
  mockPeriodFindMany,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockMakePurchaseService: vi.fn(),
  mockListPaginated: vi.fn(),
  mockContactFindMany: vi.fn(),
  mockPeriodFindMany: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/purchase/presentation/composition-root", () => ({
  makePurchaseService: mockMakePurchaseService,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findMany: mockContactFindMany },
    fiscalPeriod: { findMany: mockPeriodFindMany },
  },
}));

vi.mock("@/components/purchases/purchase-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PurchasesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({});
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakePurchaseService.mockReturnValue({ listPaginated: mockListPaginated });
  mockListPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  mockContactFindMany.mockResolvedValue([]);
  mockPeriodFindMany.mockResolvedValue([]);
});

describe("/purchases — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await PurchasesPage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "purchases",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await PurchasesPage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
