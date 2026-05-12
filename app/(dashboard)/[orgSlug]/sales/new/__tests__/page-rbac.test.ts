/**
 * /sales/new page — rbac gate tests.
 *
 * Page requires sales:write. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockContactsList,
  mockPeriodsList,
  mockAccountsList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockAccountsList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
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

import NewSalePage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockAccountsList.mockResolvedValue([]);
});

describe("/sales/new — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await NewSalePage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "sales",
      "write",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await NewSalePage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
