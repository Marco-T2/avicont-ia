/**
 * /payments/[paymentId] page — rbac gate tests.
 *
 * Page requires payments:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockNotFound,
  mockRequirePermission,
  mockPaymentGetById,
  mockContactsList,
  mockPeriodsList,
  mockDocTypesList,
  mockOrgSettingsGetOrCreate,
  mockAccountsFindChildren,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPaymentGetById: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockDocTypesList: vi.fn(),
  mockOrgSettingsGetOrCreate: vi.fn(),
  mockAccountsFindChildren: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/payment/presentation/server", () => {
  class PaymentService {
    getById = mockPaymentGetById;
  }
  return { PaymentService };
});

vi.mock("@/modules/contacts/presentation/server", () => {
  const makeContactsService = () => ({
    list: mockContactsList,
  });
  return { makeContactsService };
});

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockPeriodsList })),
}));

vi.mock("@/modules/operational-doc-type/presentation/server", () => ({
  makeOperationalDocTypeService: vi.fn(() => ({ list: mockDocTypesList })),
}));

vi.mock("@/modules/accounting/infrastructure/prisma-accounts.repo", () => {
  class PrismaAccountsRepo {
    findDetailChildrenByParentCodes = mockAccountsFindChildren;
  }
  return { PrismaAccountsRepo };
});

vi.mock("@/modules/org-settings/presentation/server", () => ({
  makeOrgSettingsService: () => ({
    getOrCreate: mockOrgSettingsGetOrCreate,
  }),
}));

vi.mock("@/components/payments/payment-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PaymentDetailPage from "../page";

const ORG_SLUG = "acme";
const PAYMENT_ID = "payment-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, paymentId: PAYMENT_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPaymentGetById.mockResolvedValue({ id: PAYMENT_ID });
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockDocTypesList.mockResolvedValue([]);
  mockOrgSettingsGetOrCreate.mockResolvedValue({
    toSnapshot: () => ({
      cashParentCode: "1.1.1",
      pettyCashParentCode: "1.1.2",
      bankParentCode: "1.1.3",
      cajaGeneralAccountCode: "1.1.1.01",
      bancoAccountCode: "1.1.3.01",
    }),
  });
  mockAccountsFindChildren.mockResolvedValue([]);
});

describe("/payments/[paymentId] — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await PaymentDetailPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "payments",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await PaymentDetailPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
