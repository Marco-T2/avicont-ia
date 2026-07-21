/**
 * /purchases/[purchaseId] page — rbac gate tests.
 *
 * Page requires purchases:write. On failure, redirect to /${orgSlug}.
 *
 * Mocks updated A3-C6b cutover: legacy `@/features/purchase/server` PurchaseService
 * replaced by hex `@/modules/purchase/presentation/composition-root` makePurchaseService
 * + Prisma direct deps lookups + `toPurchaseWithDetails` mapper invocation. Mirror
 * A3-C4b.5 sale detail page-rbac mock factory expansion pattern (engram
 * poc-nuevo/a3/c4b-5/closed) — sub-§13 in-flight absorbed inline GREEN
 * (engram-only, NO formal §13.AC-purchase variante 5 cementación).
 *
 * Purchase-pure-read (mirror sale-pure-read pilot): the two Prisma direct
 * deps lookups (contact + payable) moved behind `makePurchaseReads()` read
 * ports — the `@/lib/prisma` mock is gone; the composition-root mock now also
 * stubs `makePurchaseReads`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockPurchaseGetById,
  mockContactsList,
  mockPeriodsList,
  mockProductTypesList,
  mockAccountsList,
  mockMakePurchaseService,
  mockMakePurchaseReads,
  mockToPurchaseWithDetails,
  mockContactFindById,
  mockPayableFindWithAllocations,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPurchaseGetById: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockProductTypesList: vi.fn(),
  mockAccountsList: vi.fn(),
  mockMakePurchaseService: vi.fn(),
  mockMakePurchaseReads: vi.fn(),
  mockToPurchaseWithDetails: vi.fn(),
  mockContactFindById: vi.fn(),
  mockPayableFindWithAllocations: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/modules/permissions/application/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/purchase/presentation/composition-root", () => ({
  makePurchaseService: mockMakePurchaseService,
  makePurchaseReads: mockMakePurchaseReads,
}));

vi.mock("@/modules/purchase/presentation/mappers/purchase-to-with-details.mapper", () => ({
  toPurchaseWithDetails: mockToPurchaseWithDetails,
}));

vi.mock("@/modules/contacts/presentation/server", () => {
  const makeContactsService = () => ({
    list: mockContactsList,
  });
  return { makeContactsService };
});

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockPeriodsList })),
}));

vi.mock("@/modules/product-type/presentation/server", () => ({
  makeProductTypeService: () => ({ list: mockProductTypesList }),
}));

vi.mock("@/modules/accounting/presentation/server", () => ({
  makeAccountsService: () => ({ list: mockAccountsList }),
}));

vi.mock("@/components/purchases/purchase-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PurchaseDetailPage from "../page";

const ORG_SLUG = "acme";
const PURCHASE_ID = "purchase-1";
const PERIOD_ID = "period-1";
const CONTACT_ID = "contact-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, purchaseId: PURCHASE_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakePurchaseService.mockReturnValue({ getById: mockPurchaseGetById });
  mockMakePurchaseReads.mockReturnValue({
    contact: { findById: mockContactFindById },
    payable: { findWithAllocations: mockPayableFindWithAllocations },
  });
  mockPurchaseGetById.mockResolvedValue({
    id: PURCHASE_ID,
    periodId: PERIOD_ID,
    contactId: CONTACT_ID,
    payableId: null,
    purchaseType: "COMPRA_GENERAL",
    sequenceNumber: 1,
  });
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([
    { toSnapshot: () => ({ id: PERIOD_ID, name: "Test Period", status: "OPEN" }) },
  ]);
  mockProductTypesList.mockResolvedValue([]);
  mockAccountsList.mockResolvedValue([]);
  mockContactFindById.mockResolvedValue({
    id: CONTACT_ID,
    name: "Test Contact",
    type: "PROVEEDOR",
    nit: null,
    paymentTermsDays: 30,
  });
  mockPayableFindWithAllocations.mockResolvedValue(null);
  mockToPurchaseWithDetails.mockReturnValue({});
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
