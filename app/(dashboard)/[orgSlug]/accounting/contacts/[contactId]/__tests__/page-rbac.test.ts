/**
 * /accounting/contacts/[contactId] page — rbac gate tests.
 *
 * Page requires contacts:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequirePermission,
  mockGetById,
  mockGetBalanceSummary,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetById: vi.fn(),
  mockGetBalanceSummary: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/contacts/presentation/server", () => {
  const makeContactsService = () => ({
    getById: mockGetById,
  });
  return { makeContactsService };
});

vi.mock("@/modules/contact-balances/presentation/server", () => ({
  makeContactBalancesService: () => ({
    getBalanceSummary: mockGetBalanceSummary,
  }),
}));

vi.mock("@/components/contacts/contact-detail", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import ContactDetailPage from "../page";

const ORG_SLUG = "acme";
const CONTACT_ID = "contact-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, contactId: CONTACT_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Mock returns entity-shape stub con toSnapshot() method — page.tsx hex
  // factory consumer hace contactsService.getById().then((c) => c.toSnapshot())
  // post-cutover §13 RSC boundary serialization adapter pattern.
  mockGetById.mockResolvedValue({
    toSnapshot: () => ({ id: CONTACT_ID, name: "Contact" }),
  });
  mockGetBalanceSummary.mockResolvedValue({});
});

describe("/accounting/contacts/[contactId] — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await ContactDetailPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "contacts",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await ContactDetailPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
