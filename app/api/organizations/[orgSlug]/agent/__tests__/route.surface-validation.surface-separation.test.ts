/**
 * Route integration tests for the surface field on agent queries.
 *
 * Covers spec REQ-2 SCN-2.4 and SCN-2.5:
 *   - SCN-2.4: POST without surface → 400 with surface-aware validation error.
 *   - SCN-2.5: parsed.surface propagates from request body all the way
 *     to agentService.query(...).
 *
 * Strategy: mirrors route.confirm-create-expense.test.ts mock layout
 * (vi.hoisted + per-feature module mocks) — keeps the route handler in
 * its real form, mocks only the boundaries.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

const {
  mockRequireAuth,
  mockRequireOrgAccess,
  mockRequirePermission,
  mockGetMember,
  mockAgentQuery,
  mockRateLimitCheck,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetMember: vi.fn(),
  mockAgentQuery: vi.fn(),
  mockRateLimitCheck: vi.fn(),
}));

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: mockRequireAuth,
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
        { status: 400 },
      );
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

vi.mock("@/modules/organizations/presentation/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/organizations/presentation/server")>();
  return {
    ...actual,
    requireOrgAccess: mockRequireOrgAccess,
    makeOrganizationsService: vi.fn().mockReturnValue({
      getMemberWithUserByClerkUserId: mockGetMember,
    }),
  };
});

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/ai-agent/presentation/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/ai-agent/presentation/server")>();
  return {
    ...actual,
    makeAgentService: vi.fn(() => ({ query: mockAgentQuery })),
    makeAgentRateLimitService: vi.fn(() => ({ check: mockRateLimitCheck })),
  };
});

vi.mock("@/modules/expense/presentation/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/expense/presentation/server")>();
  return {
    ...actual,
    makeExpenseService: vi.fn(() => ({ create: vi.fn() })),
  };
});

vi.mock("@/modules/mortality/presentation/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/mortality/presentation/server")>();
  return {
    ...actual,
    makeMortalityService: vi.fn().mockImplementation(() => ({ log: vi.fn() })),
  };
});

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { POST } from "../route.ts";

const ORG_SLUG = "acme";
const ORG_ID = "org-acme";
const CLERK_USER_ID = "user_clerk_id";
const USER_ID = "user-1";

function makeRequest(body: unknown): Request {
  return new Request(`http://test/api/organizations/${ORG_SLUG}/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: CLERK_USER_ID });
  mockRequireOrgAccess.mockResolvedValue(ORG_ID);
  mockGetMember.mockResolvedValue({
    user: { id: USER_ID },
    role: "member",
  });
  mockRequirePermission.mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "member",
  });
  mockRateLimitCheck.mockResolvedValue({ allowed: true });
  mockAgentQuery.mockResolvedValue({
    message: "ok",
    suggestion: null,
    requiresConfirmation: false,
  });
});

describe("SCN-2.4: POST without surface → 400", () => {
  it("returns 400 when surface field is missing", async () => {
    const req = makeRequest({ prompt: "hola" });
    const res = await POST(req, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(400);
  });

  it("error body mentions the surface field", async () => {
    const req = makeRequest({ prompt: "hola" });
    const res = await POST(req, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    const body = await res.json();
    expect(JSON.stringify(body)).toContain("surface");
  });

  it("agentService.query is NOT called when surface missing", async () => {
    const req = makeRequest({ prompt: "hola" });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(mockAgentQuery).not.toHaveBeenCalled();
  });
});

describe("SCN-2.5: parsed.surface propagates to agentService.query", () => {
  it("query is called with surface: 'sidebar-qa' (positional arg 6)", async () => {
    const req = makeRequest({ prompt: "hola", surface: "sidebar-qa" });
    const res = await POST(req, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(200);
    expect(mockAgentQuery).toHaveBeenCalledTimes(1);
    // Positional signature: (orgId, userId, role, prompt, sessionId, surface, mode, contextHints)
    const callArgs = mockAgentQuery.mock.calls[0];
    expect(callArgs[5]).toBe("sidebar-qa");
  });

  it("query is called with surface: 'modal-registrar'", async () => {
    const req = makeRequest({
      prompt: "registrar gasto",
      surface: "modal-registrar",
    });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    const callArgs = mockAgentQuery.mock.calls[0];
    expect(callArgs[5]).toBe("modal-registrar");
  });

  it("invalid surface enum value → 400, query NOT called", async () => {
    const req = makeRequest({ prompt: "hola", surface: "sidebar-unknown" });
    const res = await POST(req, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(400);
    expect(mockAgentQuery).not.toHaveBeenCalled();
  });
});
