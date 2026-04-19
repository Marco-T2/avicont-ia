/**
 * /payments page — rbac gate tests.
 *
 * Page requires payments:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockPaymentList,
  mockContactsList,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPaymentList: vi.fn(),
  mockContactsList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/payment/server", () => {
  class PaymentService {
    list = mockPaymentList;
  }
  return { PaymentService };
});

vi.mock("@/features/contacts/server", () => {
  class ContactsService {
    list = mockContactsList;
  }
  return { ContactsService };
});

vi.mock("@/components/payments/payment-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import PaymentsPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPaymentList.mockResolvedValue([]);
  mockContactsList.mockResolvedValue([]);
});

describe("/payments — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await PaymentsPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "payments",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await PaymentsPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
