/**
 * /sales/[saleId] page — rbac gate tests.
 *
 * Page requires sales:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockSaleGetById,
  mockContactsList,
  mockPeriodsList,
  mockAccountsList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockSaleGetById: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockAccountsList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/sale", () => {
  class SaleService {
    getById = mockSaleGetById;
  }
  return { SaleService };
});

vi.mock("@/features/contacts", () => {
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

vi.mock("@/features/accounting", () => {
  class AccountsService {
    list = mockAccountsList;
  }
  return { AccountsService };
});

vi.mock("@/components/sales/sale-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import SaleDetailPage from "../page";

const ORG_SLUG = "acme";
const SALE_ID = "sale-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, saleId: SALE_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSaleGetById.mockResolvedValue({ id: SALE_ID, periodId: "period-1" });
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockAccountsList.mockResolvedValue([]);
});

describe("/sales/[saleId] — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await SaleDetailPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await SaleDetailPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
