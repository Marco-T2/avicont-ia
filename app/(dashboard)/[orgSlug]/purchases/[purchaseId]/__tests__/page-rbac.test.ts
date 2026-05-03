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
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockPurchaseGetById,
  mockContactsList,
  mockPeriodsList,
  mockProductTypesList,
  mockMakePurchaseService,
  mockToPurchaseWithDetails,
  mockContactFindUnique,
  mockPayableFindUnique,
  mockIvaPurchaseBookFindUnique,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPurchaseGetById: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockProductTypesList: vi.fn(),
  mockMakePurchaseService: vi.fn(),
  mockToPurchaseWithDetails: vi.fn(),
  mockContactFindUnique: vi.fn(),
  mockPayableFindUnique: vi.fn(),
  mockIvaPurchaseBookFindUnique: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/purchase/presentation/composition-root", () => ({
  makePurchaseService: mockMakePurchaseService,
}));

vi.mock("@/modules/purchase/presentation/mappers/purchase-to-with-details.mapper", () => ({
  toPurchaseWithDetails: mockToPurchaseWithDetails,
  // A3-C6b §13.AC-purchase variante 5: page imports TYPE_PREFIXES + computeDisplayCode
  // post A3-C6a mapper refactor — mock factory debe exponer ambos o crash runtime.
  // Stubs simples (test NO assertea displayCode value). Asimetría purchase vs sale:
  // TYPE_PREFIXES Record polymorphic FL/PF/CG/SV vs SALE_PREFIX fixed string VG.
  TYPE_PREFIXES: {
    FLETE: "FL",
    POLLO_FAENADO: "PF",
    COMPRA_GENERAL: "CG",
    SERVICIO: "SV",
  },
  computeDisplayCode: (purchaseType: string, n: number) =>
    `${purchaseType.slice(0, 2)}-${String(n).padStart(3, "0")}`,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findUnique: mockContactFindUnique },
    accountsPayable: { findUnique: mockPayableFindUnique },
    ivaPurchaseBook: { findUnique: mockIvaPurchaseBookFindUnique },
  },
}));

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
const PERIOD_ID = "period-1";
const CONTACT_ID = "contact-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, purchaseId: PURCHASE_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakePurchaseService.mockReturnValue({ getById: mockPurchaseGetById });
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
    { id: PERIOD_ID, name: "Test Period", status: "OPEN" },
  ]);
  mockProductTypesList.mockResolvedValue([]);
  mockContactFindUnique.mockResolvedValue({
    id: CONTACT_ID,
    name: "Test Contact",
    type: "PROVEEDOR",
    nit: null,
    paymentTermsDays: 30,
  });
  mockPayableFindUnique.mockResolvedValue(null);
  mockIvaPurchaseBookFindUnique.mockResolvedValue(null);
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
