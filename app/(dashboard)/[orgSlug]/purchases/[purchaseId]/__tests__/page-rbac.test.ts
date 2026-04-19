/**
 * /purchases/[purchaseId] page — rbac gate tests.
 *
 * Page requires purchases:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockPurchaseGetById,
  mockContactsList,
  mockPeriodsList,
  mockProductTypesList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPurchaseGetById: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockProductTypesList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/purchase/server", () => {
  class PurchaseService {
    getById = mockPurchaseGetById;
  }
  return { PurchaseService };
});

vi.mock("@/features/contacts/server", () => {
  class ContactsService {
    list = mockContactsList;
  }
  return { ContactsService };
});

vi.mock("@/features/fiscal-periods/server", () => {
  class FiscalPeriodsService {
    list = mockPeriodsList;
  }
  return { FiscalPeriodsService };
});

vi.mock("@/features/product-types/server", () => {
  class ProductTypesService {
    list = mockProductTypesList;
  }
  return { ProductTypesService };
});

vi.mock("@/components/purchases/purchase-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PurchaseDetailPage from "../page";

const ORG_SLUG = "acme";
const PURCHASE_ID = "purchase-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, purchaseId: PURCHASE_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPurchaseGetById.mockResolvedValue({
    id: PURCHASE_ID,
    periodId: "period-1",
    purchaseType: "COMPRA_GENERAL",
  });
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockProductTypesList.mockResolvedValue([]);
});

describe("/purchases/[purchaseId] — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await PurchaseDetailPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "purchases",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await PurchaseDetailPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
