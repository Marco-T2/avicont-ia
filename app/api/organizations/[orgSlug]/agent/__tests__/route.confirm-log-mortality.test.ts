/**
 * Tests de integración del action confirm con suggestion.action='logMortality'.
 *
 * Cubre:
 *   - Happy path: 201 + mortalityService.log invocado con args mapeados (incl. createdById desde session.user.id).
 *   - Response body shape preserve { message: "Mortalidad registrada exitosamente.", data: <log.toJSON()> }.
 *   - cause optional preserve: undefined → no key, "enfermedad" → passed-through (regression guard
 *     mortality cause optional invariant per Marco lock D-CONFIRM-CARD-MORTALITY-CAUSE: display defer
 *     cleanup pending pero backend invariant cementado).
 *   - Payload inválido: missing count / count non-integer 1.5 → 400.
 *
 * Cementación retroactiva preventiva pre-frontend integration POC #2 AI tools writing
 * granjas (paired sister precedent route.confirm-journal-entry.test.ts EXACT mirror).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
  process.env.CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY ?? "test-key-for-vitest";
});

const {
  mockRequireAuth,
  mockRequireOrgAccess,
  mockRequirePermission,
  mockGetMember,
  mockMortalityLog,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetMember: vi.fn(),
  mockMortalityLog: vi.fn(),
}));

// ── Module mocks ────────────────────────────────────────────────────────────

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
  const actual = await importOriginal<typeof import("@/modules/organizations/presentation/server")>();
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
  const actual = await importOriginal<typeof import("@/modules/ai-agent/presentation/server")>();
  return {
    ...actual,
    AgentService: vi.fn().mockImplementation(function () {
      return { query: vi.fn() };
    }),
    AgentRateLimitService: vi.fn().mockImplementation(function () {
      return { check: vi.fn().mockResolvedValue({ allowed: true }) };
    }),
  };
});

vi.mock("@/modules/expense/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/expense/presentation/server")>();
  return {
    ...actual,
    makeExpenseService: vi.fn(() => ({ create: vi.fn() })),
  };
});

vi.mock("@/modules/mortality/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/mortality/presentation/server")>();
  return {
    ...actual,
    makeMortalityService: vi.fn().mockImplementation(() => ({
      log: mockMortalityLog,
    })),
  };
});

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { POST } from "../route";

// ── Constants & fixtures ───────────────────────────────────────────────────

const ORG_SLUG = "acme";
const ORG_ID = "org-acme";
const CLERK_USER_ID = "user_clerk_id";
const USER_ID = "user-1";
const LOT_ID = "clxx00000000000000000001";

function validSuggestionData() {
  return {
    count: 5,
    cause: "enfermedad",
    date: "2026-04-26",
    lotId: LOT_ID,
  };
}

function makeMortalityEntity(overrides: Record<string, unknown> = {}) {
  const json = {
    id: "mort-1",
    count: 5,
    cause: "enfermedad",
    date: "2026-04-26T00:00:00.000Z",
    lotId: LOT_ID,
    createdById: USER_ID,
    ...overrides,
  };
  return { toJSON: () => json };
}

function makeRequest(body: unknown, action = "confirm"): Request {
  return new Request(`http://test/api/organizations/${ORG_SLUG}/agent?action=${action}`, {
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
  mockMortalityLog.mockResolvedValue(makeMortalityEntity());
});

describe("POST /api/organizations/[orgSlug]/agent?action=confirm — logMortality", () => {
  it("(α1) happy path: 201 + mortalityService.log invocado con args mapeados", async () => {
    const req = makeRequest({
      suggestion: { action: "logMortality", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    expect(mockMortalityLog).toHaveBeenCalledTimes(1);
    expect(mockMortalityLog).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        count: 5,
        cause: "enfermedad",
        lotId: LOT_ID,
        createdById: USER_ID,
      }),
    );
    const callArgs = mockMortalityLog.mock.calls[0][1] as { date: Date };
    expect(callArgs.date).toBeInstanceOf(Date);
    expect(callArgs.date.toISOString().slice(0, 10)).toBe("2026-04-26");
  });

  it("(α2) response body shape preserve { message, data: log.toJSON() }", async () => {
    const req = makeRequest({
      suggestion: { action: "logMortality", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const body = await res.json();
    expect(body.message).toBe("Mortalidad registrada exitosamente.");
    expect(body.data).toMatchObject({
      id: "mort-1",
      count: 5,
      cause: "enfermedad",
      lotId: LOT_ID,
    });
  });

  it("(α3) cause undefined preserve: NO se pasa al service", async () => {
    const data = validSuggestionData() as Partial<ReturnType<typeof validSuggestionData>>;
    delete data.cause;
    mockMortalityLog.mockResolvedValueOnce(makeMortalityEntity({ cause: undefined }));
    const req = makeRequest({ suggestion: { action: "logMortality", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    const callArgs = mockMortalityLog.mock.calls[0][1] as { cause?: string };
    expect(callArgs.cause).toBeUndefined();
  });

  it("(α4) cause 'enfermedad' passed-through (regression guard cause optional invariant)", async () => {
    const req = makeRequest({
      suggestion: { action: "logMortality", data: validSuggestionData() },
    });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const callArgs = mockMortalityLog.mock.calls[0][1] as { cause?: string };
    expect(callArgs.cause).toBe("enfermedad");
  });

  it("(α5) createdById se inyecta desde session.user.id (no desde suggestion.data)", async () => {
    const data = { ...validSuggestionData(), createdById: "ATTACKER_ID" };
    const req = makeRequest({ suggestion: { action: "logMortality", data } });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const callArgs = mockMortalityLog.mock.calls[0][1] as { createdById: string };
    expect(callArgs.createdById).toBe(USER_ID);
    expect(callArgs.createdById).not.toBe("ATTACKER_ID");
  });

  it("(α6) payload sin count → 400 (Zod rechaza)", async () => {
    const data = validSuggestionData() as Partial<ReturnType<typeof validSuggestionData>>;
    delete data.count;
    const req = makeRequest({ suggestion: { action: "logMortality", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockMortalityLog).not.toHaveBeenCalled();
  });

  it("(α7) count non-integer 1.5 → 400 (Zod rechaza)", async () => {
    const data = { ...validSuggestionData(), count: 1.5 };
    const req = makeRequest({ suggestion: { action: "logMortality", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockMortalityLog).not.toHaveBeenCalled();
  });
});
