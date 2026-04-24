/**
 * B8 — RED: Trial Balance page RSC tests.
 *
 * Asserts:
 * (a) requirePermission("reports","read") gate fires with correct args.
 * (b) On missing permission (throws) → redirect called with /<orgSlug>.
 * (c) On authorized → page renders without redirect.
 *
 * Covers C9.S1 (page-level RBAC check).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRedirect, mockRequirePermission } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

// Mock TrialBalancePageClient so JSX rendering is not needed
vi.mock("@/components/accounting/trial-balance-page-client", () => ({
  TrialBalancePageClient: vi.fn().mockReturnValue(null),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import TrialBalancePage from "../page";

const ORG_SLUG = "test-org";
const ORG_ID = "org-tb-page-id";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/accounting/trial-balance — TrialBalancePage (C9.S1)", () => {
  it("(a) calls requirePermission('reports', 'read', orgSlug)", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: ORG_ID, role: "contador" });

    await TrialBalancePage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith("reports", "read", ORG_SLUG);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("(b) redirects to /<orgSlug> when requirePermission throws (RBAC gate)", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await TrialBalancePage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });

  it("(c) does NOT redirect when permission is granted", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: ORG_ID, role: "admin" });

    await TrialBalancePage({ params: makeParams() });

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
