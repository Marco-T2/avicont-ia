/**
 * /sales page — rbac gate tests.
 *
 * Page requires sales:read. On failure, redirect to /${orgSlug}.
 *
 * Mocks updated A3-C4a.5 paired follow-up: legacy `@/features/sale/server`
 * SaleService stale post A3-C4a cutover replaced by hex
 * `@/modules/sale/presentation/composition-root` makeSaleService + Prisma
 * direct mocks (contact + fiscalPeriod findMany batch lookups). Mock
 * anomaly absorbed inline GREEN sub-§13 in-flight surface mirror A3-C4b
 * page-rbac precedent (engram #1532). Test semantics RBAC-only preserved
 * (data path empty array — mapper never invoked).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockMakeSaleService,
  mockList,
  mockContactFindMany,
  mockPeriodFindMany,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockMakeSaleService: vi.fn(),
  mockList: vi.fn(),
  mockContactFindMany: vi.fn(),
  mockPeriodFindMany: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/sale/presentation/composition-root", () => ({
  makeSaleService: mockMakeSaleService,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findMany: mockContactFindMany },
    fiscalPeriod: { findMany: mockPeriodFindMany },
  },
}));

vi.mock("@/components/sales/sale-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import SalesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakeSaleService.mockReturnValue({ list: mockList });
  mockList.mockResolvedValue([]);
  mockContactFindMany.mockResolvedValue([]);
  mockPeriodFindMany.mockResolvedValue([]);
});

describe("/sales — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await SalesPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await SalesPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
