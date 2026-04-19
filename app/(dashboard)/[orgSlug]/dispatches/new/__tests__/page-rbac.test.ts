/**
 * /dispatches/new page — rbac gate tests.
 *
 * Page requires sales:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockContactsList,
  mockPeriodsList,
  mockProductTypesList,
  mockOrgSettingsGetOrCreate,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockProductTypesList: vi.fn(),
  mockOrgSettingsGetOrCreate: vi.fn(),
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

vi.mock("@/features/product-types", () => {
  class ProductTypesService {
    list = mockProductTypesList;
  }
  return { ProductTypesService };
});

vi.mock("@/features/org-settings", () => {
  class OrgSettingsService {
    getOrCreate = mockOrgSettingsGetOrCreate;
  }
  return { OrgSettingsService };
});

vi.mock("@/components/dispatches/dispatch-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import NewDispatchPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({ type: "NOTA_DESPACHO" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockProductTypesList.mockResolvedValue([]);
  mockOrgSettingsGetOrCreate.mockResolvedValue({ roundingThreshold: "0" });
});

describe("/dispatches/new — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await NewDispatchPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await NewDispatchPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
