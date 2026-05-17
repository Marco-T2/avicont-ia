/**
 * Route integration test for module_hint -> moduleHint propagation.
 *
 * Covers spec REQ-3 (design D3.2): route handler coerces body.module_hint
 * (undefined | null | "accounting" | "farm") into a positional moduleHint
 * argument on agentService.query(...).
 *
 * Strategy mirrors route.surface-validation.surface-separation.test.ts —
 * vi.hoisted mocks for middleware, permissions, services; spy on the
 * mocked agentService.query.
 *
 * POSITIONAL SIGNATURE (post-SDD agent-sidebar-module-hint):
 *   (0) orgId
 *   (1) userId
 *   (2) role
 *   (3) prompt
 *   (4) sessionId
 *   (5) surface
 *   (6) mode
 *   (7) contextHints
 *   (8) moduleHint     <- NEW
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
  process.env.CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY ?? "test-key-for-vitest";
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

describe("SCN-7.1: body.module_hint='accounting' propagates as 9th positional arg", () => {
  it("query is called with moduleHint='accounting' at index 8", async () => {
    const req = makeRequest({
      prompt: "hola",
      surface: "sidebar-qa",
      module_hint: "accounting",
    });
    const res = await POST(req, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(200);
    expect(mockAgentQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockAgentQuery.mock.calls[0];
    expect(callArgs[8]).toBe("accounting");
  });
});

describe("SCN-7.2: body.module_hint=null propagates as null", () => {
  it("query is called with moduleHint=null at index 8", async () => {
    const req = makeRequest({
      prompt: "hola",
      surface: "sidebar-qa",
      module_hint: null,
    });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    const callArgs = mockAgentQuery.mock.calls[0];
    expect(callArgs[8]).toBeNull();
  });
});

describe("SCN-7.3: body.module_hint ABSENT coerces to null at the boundary", () => {
  it("query is called with moduleHint=null when key missing (?? null at route)", async () => {
    const req = makeRequest({
      prompt: "hola",
      surface: "sidebar-qa",
    });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    const callArgs = mockAgentQuery.mock.calls[0];
    expect(callArgs[8]).toBeNull();
  });
});
