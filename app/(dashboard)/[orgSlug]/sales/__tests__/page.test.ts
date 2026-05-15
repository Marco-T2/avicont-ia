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
 *
 * C0 GREEN poc-dispatch-retirement-into-sales: dispatchService mock added
 * (twin-call cross-module read). RBAC semantics preserved — empty list
 * default keeps mapper paths shallow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockMakeSaleService,
  mockListPaginated,
  mockMakeDispatchService,
  mockDispatchListPaginated,
  mockContactFindMany,
  mockPeriodFindMany,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockMakeSaleService: vi.fn(),
  mockListPaginated: vi.fn(),
  mockMakeDispatchService: vi.fn(),
  mockDispatchListPaginated: vi.fn(),
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

vi.mock("@/modules/dispatch/presentation/composition-root", () => ({
  makeDispatchService: mockMakeDispatchService,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findMany: mockContactFindMany },
    fiscalPeriod: { findMany: mockPeriodFindMany },
  },
}));

vi.mock("@/components/sales/transactions-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import SalesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({});
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakeSaleService.mockReturnValue({ listPaginated: mockListPaginated });
  mockListPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  // poc-sales-unified-pagination C2 cutover: dispatch call migrated
  // `list` → `listPaginated` (UNION pagination). Mock returns PaginatedResult
  // shape; default empty preserves RBAC semantics (mapper never invoked).
  mockMakeDispatchService.mockReturnValue({
    listPaginated: mockDispatchListPaginated,
  });
  mockDispatchListPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  mockContactFindMany.mockResolvedValue([]);
  mockPeriodFindMany.mockResolvedValue([]);
});

describe("/sales — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await SalesPage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await SalesPage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});

// W-02 gap (verify-report #2525): dispatchType filter wired to
// dispatchService.listPaginated was covered structurally via α07/α08 sentinels
// but had no integration assertion. This test verifies the param-to-options
// mapping: sp.type=NOTA_DESPACHO → dispatchListPaginated({dispatchType:'NOTA_DESPACHO'}).
// sp.type=BOLETA_CERRADA follows identical logic (same branch); one case
// sufficient per [[low_cost_verification_asymmetry]].
describe("/sales — dispatchType filter propagation (RSC UNION twin-call)", () => {
  it("wires ?type=NOTA_DESPACHO to dispatchService.listPaginated dispatchType option", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await SalesPage({
      params: makeParams(),
      searchParams: Promise.resolve({ type: "NOTA_DESPACHO" }),
    });

    expect(mockDispatchListPaginated).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ dispatchType: "NOTA_DESPACHO" }),
      expect.any(Object),
    );
  });

  it("does NOT pass dispatchType to dispatchService.listPaginated when ?type=VENTA_GENERAL", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await SalesPage({
      params: makeParams(),
      searchParams: Promise.resolve({ type: "VENTA_GENERAL" }),
    });

    expect(mockDispatchListPaginated).toHaveBeenCalledWith(
      "org-1",
      expect.not.objectContaining({ dispatchType: expect.anything() }),
      expect.any(Object),
    );
  });
});
