/**
 * T59 — RED: Close Event Viewer page RBAC gate tests.
 *
 * Asserts:
 * (a) Page calls requirePermission("journal", "read", orgSlug).
 * (b) On forbidden → redirect to /<orgSlug>.
 * (c) On authorized → page does not redirect.
 *
 * Fails until T60 creates close-event/page.tsx.
 *
 * FLIPPED (audit-pure-read Group B): this test historically mocked
 * `@/lib/prisma` (`prisma.auditLog.findMany`) — the page's direct read. The
 * read now lives behind the audit-owned `AuditCloseEventReaderPort` exposed
 * via `makeAuditReads()`, so the test mocks the composition root instead of
 * reaching through the Prisma adapter internals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRedirect, mockRequirePermission, mockListByCorrelation } = vi.hoisted(
  () => ({
    mockRedirect: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockListByCorrelation: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/modules/permissions/application/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/audit/presentation/server", () => ({
  makeAuditReads: () => ({
    closeEvents: { listByCorrelation: mockListByCorrelation },
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import CloseEventPage from "../close-event/page";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";
const ORG_ID = "org-close-event-1";
const CORRELATION_ID = "corr-uuid-viewer-test";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams(correlationId?: string) {
  return Promise.resolve(correlationId ? { correlationId } : {});
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListByCorrelation.mockResolvedValue([]);
});

describe("/accounting/monthly-close/close-event — CloseEventPage RBAC", () => {
  it("(a) calls requirePermission('journal', 'read', orgSlug)", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

    await CloseEventPage({
      params: makeParams(),
      searchParams: makeSearchParams(CORRELATION_ID),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith("period", "read", ORG_SLUG);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("(b) redirects to /<orgSlug> when requirePermission throws (RBAC gate)", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await CloseEventPage({
      params: makeParams(),
      searchParams: makeSearchParams(CORRELATION_ID),
    });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });

  it("(c) does NOT redirect when permission is granted", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

    await CloseEventPage({
      params: makeParams(),
      searchParams: makeSearchParams(CORRELATION_ID),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
