/**
 * /payments/new page — rbac gate tests.
 *
 * Page requires payments:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockContactsList,
  mockPeriodsList,
  mockDocTypesList,
  mockOrgSettingsGetOrCreate,
  mockAccountsFindChildren,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockDocTypesList: vi.fn(),
  mockOrgSettingsGetOrCreate: vi.fn(),
  mockAccountsFindChildren: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
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

vi.mock("@/features/operational-doc-types/server", () => {
  class OperationalDocTypesService {
    list = mockDocTypesList;
  }
  return { OperationalDocTypesService };
});

vi.mock("@/features/accounting", () => {
  class AccountsRepository {
    findDetailChildrenByParentCodes = mockAccountsFindChildren;
  }
  return { AccountsRepository };
});

vi.mock("@/features/org-settings", () => {
  class OrgSettingsService {
    getOrCreate = mockOrgSettingsGetOrCreate;
  }
  return { OrgSettingsService };
});

vi.mock("@/components/payments/payment-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import NewPaymentPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({ type: "COBRO" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockDocTypesList.mockResolvedValue([]);
  mockOrgSettingsGetOrCreate.mockResolvedValue({
    cashParentCode: "1.1.1",
    pettyCashParentCode: "1.1.2",
    bankParentCode: "1.1.3",
    cajaGeneralAccountCode: "1.1.1.01",
    bancoAccountCode: "1.1.3.01",
  });
  mockAccountsFindChildren.mockResolvedValue([]);
});

describe("/payments/new — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "payments",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
