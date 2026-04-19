/**
 * /accounting/contacts page — rbac gate tests.
 *
 * Page requires contacts:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockListWithBalances,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListWithBalances: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/contacts/server", () => {
  class ContactsService {
    listWithBalances = mockListWithBalances;
    setReceivablesService = vi.fn();
    setPayablesService = vi.fn();
  }
  return { ContactsService };
});

vi.mock("@/features/receivables", () => {
  class ReceivablesService {}
  return { ReceivablesService };
});

vi.mock("@/features/payables", () => {
  class PayablesService {}
  return { PayablesService };
});

vi.mock("@/components/contacts/contact-list", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import ContactsPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListWithBalances.mockResolvedValue([]);
});

describe("/accounting/contacts — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await ContactsPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "contacts",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await ContactsPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
