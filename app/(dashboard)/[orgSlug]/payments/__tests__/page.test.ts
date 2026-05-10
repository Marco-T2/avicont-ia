/**
 * /payments page — rbac gate tests.
 *
 * Page requires payments:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockListPaginated,
  mockContactsList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListPaginated: vi.fn(),
  mockContactsList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/payment/presentation/server", () => {
  class PaymentService {
    listPaginated = mockListPaginated;
  }
  return { PaymentService };
});

vi.mock("@/modules/contacts/presentation/server", () => {
  const makeContactsService = () => ({
    list: mockContactsList,
  });
  return { makeContactsService };
});

vi.mock("@/components/payments/payment-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PaymentsPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams() {
  return Promise.resolve({});
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  mockContactsList.mockResolvedValue([]);
});

describe("/payments — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await PaymentsPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "payments",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await PaymentsPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
