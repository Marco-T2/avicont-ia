/**
 * /sales/[saleId] page — rbac gate tests.
 *
 * Page requires sales:write. On failure, redirect to /${orgSlug}.
 *
 * Mocks updated A3-C4b cutover: legacy `@/features/sale/server` SaleService
 * replaced by hex `@/modules/sale/presentation/composition-root` makeSaleService
 * + Prisma direct deps lookups + `toSaleWithDetails` mapper invocation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockSaleGetById,
  mockContactsList,
  mockPeriodsList,
  mockAccountsList,
  mockMakeSaleService,
  mockToSaleWithDetails,
  mockContactFindUnique,
  mockReceivableFindUnique,
  mockIvaSalesBookFindUnique,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockSaleGetById: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockAccountsList: vi.fn(),
  mockMakeSaleService: vi.fn(),
  mockToSaleWithDetails: vi.fn(),
  mockContactFindUnique: vi.fn(),
  mockReceivableFindUnique: vi.fn(),
  mockIvaSalesBookFindUnique: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/sale/presentation/composition-root", () => ({
  makeSaleService: mockMakeSaleService,
}));

vi.mock("@/modules/sale/presentation/mappers/sale-to-with-details.mapper", () => ({
  toSaleWithDetails: mockToSaleWithDetails,
  // A3-C4b.5 §13.AC-sale-paged: page imports SALE_PREFIX + computeDisplayCode
  // post A3-C4a.5 mapper refactor — mock factory debe exponer ambos o crash
  // runtime. Stubs simples (test NO assertea displayCode value).
  SALE_PREFIX: "VG",
  computeDisplayCode: (n: number) => `VG-${String(n).padStart(3, "0")}`,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findUnique: mockContactFindUnique },
    accountsReceivable: { findUnique: mockReceivableFindUnique },
    ivaSalesBook: { findUnique: mockIvaSalesBookFindUnique },
  },
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

vi.mock("@/modules/accounting/presentation/server", () => ({
  makeAccountsService: () => ({ list: mockAccountsList }),
}));

vi.mock("@/components/sales/sale-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import SaleDetailPage from "../page";

const ORG_SLUG = "acme";
const SALE_ID = "sale-1";
const PERIOD_ID = "period-1";
const CONTACT_ID = "contact-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, saleId: SALE_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMakeSaleService.mockReturnValue({ getById: mockSaleGetById });
  mockSaleGetById.mockResolvedValue({
    id: SALE_ID,
    periodId: PERIOD_ID,
    contactId: CONTACT_ID,
    receivableId: null,
  });
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([
    { toSnapshot: () => ({ id: PERIOD_ID, name: "Test Period", status: "OPEN" }) },
  ]);
  mockAccountsList.mockResolvedValue([]);
  mockContactFindUnique.mockResolvedValue({
    id: CONTACT_ID,
    name: "Test Contact",
    type: "CLIENTE",
    nit: null,
    paymentTermsDays: 30,
  });
  mockReceivableFindUnique.mockResolvedValue(null);
  mockIvaSalesBookFindUnique.mockResolvedValue(null);
  mockToSaleWithDetails.mockReturnValue({});
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
