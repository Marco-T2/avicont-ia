/**
 * Phase 6b — T38c RED: Route handler tests for GET /monthly-close/summary
 *
 * Covers:
 *   (a) 200 response includes balance subobject with 4 string fields
 *   (b) response MUST NOT include unbalancedEntries field
 *
 * Fails before T38b enriches getSummary — but since T38b already landed,
 * this is expected to go GREEN immediately on T38d (no-op route check).
 * Written as RED to fulfil the strict TDD protocol (commit before GREEN).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockGetSummary } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetSummary: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/monthly-close/server", () => ({
  MonthlyCloseService: vi.fn().mockImplementation(function () {
    return { getSummary: mockGetSummary };
  }),
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

const fullSummary = {
  periodId: "period-1",
  periodStatus: "OPEN",
  posted: { dispatches: 5, payments: 3, journalEntries: 10 },
  drafts: { dispatches: 0, payments: 0, journalEntries: 0 },
  journalsByVoucherType: [],
  balance: {
    balanced: true,
    totalDebit: "1000.00",
    totalCredit: "1000.00",
    difference: "0.00",
  },
};

function makeParams(slug = ORG_SLUG) {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(periodId = "period-1") {
  return new Request(
    `http://localhost/api/organizations/${ORG_SLUG}/monthly-close/summary?periodId=${periodId}`,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
  mockGetSummary.mockResolvedValue(fullSummary);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/.../monthly-close/summary — balance field", () => {
  it("(a) returns balance field with balanced, totalDebit, totalCredit, difference", async () => {
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.balance).toBeDefined();
    expect(typeof body.balance.balanced).toBe("boolean");
    expect(typeof body.balance.totalDebit).toBe("string");
    expect(typeof body.balance.totalCredit).toBe("string");
    expect(typeof body.balance.difference).toBe("string");

    expect(body.balance.balanced).toBe(true);
    expect(body.balance.totalDebit).toBe("1000.00");
    expect(body.balance.totalCredit).toBe("1000.00");
    expect(body.balance.difference).toBe("0.00");
  });

  it("(b) response must NOT include unbalancedEntries field", async () => {
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.unbalancedEntries).toBeUndefined();
    expect("unbalancedEntries" in body).toBe(false);
  });

  it("(c) gates on resource=period action=read", async () => {
    await GET(makeRequest(), { params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith("period", "read", ORG_SLUG);
  });
});
