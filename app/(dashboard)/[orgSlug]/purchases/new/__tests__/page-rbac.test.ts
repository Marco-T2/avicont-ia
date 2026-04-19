/**
 * /purchases/new page — rbac gate tests.
 *
 * Page requires purchases:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockContactsList,
  mockPeriodsList,
  mockProductTypesList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockProductTypesList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/contacts", () => {
  class ContactsService {
    list = mockContactsList;
  }
  return { ContactsService };
});

vi.mock("@/features/fiscal-periods", () => {
  class FiscalPeriodsService {
    list = mockPeriodsList;
  }
  return { FiscalPeriodsService };
});

vi.mock("@/features/product-types", () => {
  class ProductTypesService {
    list = mockProductTypesList;
  }
  return { ProductTypesService };
});

vi.mock("@/features/purchase", () => ({}));

vi.mock("@/components/purchases/purchase-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import NewPurchasePage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({ type: "COMPRA_GENERAL" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockProductTypesList.mockResolvedValue([]);
});

describe("/purchases/new — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await NewPurchasePage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "purchases",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await NewPurchasePage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
