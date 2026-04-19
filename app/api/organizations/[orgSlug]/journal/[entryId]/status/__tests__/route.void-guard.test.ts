/**
 * T2.5 RED → GREEN — API route test for void guard (REQ-E.1)
 *
 * PATCH /api/organizations/:orgSlug/journal/:entryId/status
 * with targetStatus=VOIDED on an auto-generated JE (sourceType="sale")
 * MUST return 422 with code=AUTO_ENTRY_VOID_FORBIDDEN.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTransitionStatus } = vi.hoisted(() => ({
  mockTransitionStatus: vi.fn(),
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.statusCode },
      );
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/features/shared/users.service", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return {
      resolveByClerkId: vi.fn().mockResolvedValue({ id: "user-db-id" }),
    };
  }),
}));

vi.mock("@/features/accounting/server", () => ({
  JournalService: vi.fn().mockImplementation(function () {
    return { transitionStatus: mockTransitionStatus };
  }),
}));

import { requirePermission } from "@/features/shared/permissions.server";
import { ValidationError, AUTO_ENTRY_VOID_FORBIDDEN } from "@/features/shared/errors";
import { PATCH } from "../route";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const ENTRY_ID = "je-auto-001";

function makeParams(
  orgSlug = ORG_SLUG,
  entryId = ENTRY_ID,
): Promise<{ orgSlug: string; entryId: string }> {
  return Promise.resolve({ orgSlug, entryId });
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: { userId: "clerk-user-id" },
    orgId: ORG_ID,
    role: "owner",
  });
});

describe("PATCH /journal/[entryId]/status — void guard (REQ-E.1)", () => {
  it("T2.5 — VOIDED on auto-JE (sourceType='sale') → 422 with AUTO_ENTRY_VOID_FORBIDDEN", async () => {
    mockTransitionStatus.mockRejectedValue(
      new ValidationError(
        "Este asiento fue generado automáticamente.",
        AUTO_ENTRY_VOID_FORBIDDEN,
      ),
    );

    const res = await PATCH(makeRequest({ status: "VOIDED" }), {
      params: makeParams(),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(AUTO_ENTRY_VOID_FORBIDDEN);
  });

  it("T2.5b — VOIDED on manual JE (sourceType=null) → 200 success", async () => {
    mockTransitionStatus.mockResolvedValue({
      id: ENTRY_ID,
      status: "VOIDED",
      sourceType: null,
    });

    const res = await PATCH(makeRequest({ status: "VOIDED" }), {
      params: makeParams(),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("VOIDED");
  });

  it("T2.5c — POSTED on auto-JE → guard not triggered, 200 success", async () => {
    // statusTransitionSchema allows "POSTED" — this tests guard does NOT fire for non-VOIDED
    mockTransitionStatus.mockResolvedValue({
      id: ENTRY_ID,
      status: "POSTED",
      sourceType: "sale",
    });

    const res = await PATCH(makeRequest({ status: "POSTED" }), {
      params: makeParams(),
    });

    expect(res.status).toBe(200);
  });
});
