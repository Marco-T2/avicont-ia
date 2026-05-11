/**
 * Tests de integración del action confirm con suggestion.action='createExpense'.
 *
 * Cubre:
 *   - Happy path: 201 + expensesService.create invocado con args mapeados (incl. createdById desde session.user.id).
 *   - Response body shape preserve { message: "Gasto registrado exitosamente.", data: <expense> }.
 *   - description optional preserve.
 *   - Payload inválido: missing amount / category enum out-of-range / lotId no-cuid → 400.
 *
 * Cementación retroactiva preventiva pre-frontend integration POC #2 AI tools writing
 * granjas (paired sister precedent route.confirm-journal-entry.test.ts EXACT mirror).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

const {
  mockRequireAuth,
  mockRequireOrgAccess,
  mockRequirePermission,
  mockGetMember,
  mockExpenseCreate,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetMember: vi.fn(),
  mockExpenseCreate: vi.fn(),
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

vi.mock("@/features/organizations/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/organizations/server")>();
  return {
    ...actual,
    requireOrgAccess: mockRequireOrgAccess,
    OrganizationsService: vi.fn().mockImplementation(function () {
      return { getMemberWithUserByClerkUserId: mockGetMember };
    }),
  };
});

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/ai-agent/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai-agent/server")>();
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

vi.mock("@/features/expenses/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/expenses/server")>();
  return {
    ...actual,
    ExpensesService: vi.fn().mockImplementation(function () {
      return { create: mockExpenseCreate };
    }),
  };
});

vi.mock("@/modules/mortality/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/mortality/presentation/server")>();
  return {
    ...actual,
    makeMortalityService: vi.fn().mockImplementation(() => ({
      log: vi.fn(),
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
    amount: 200,
    category: "ALIMENTO",
    description: "Compra balanceado",
    date: "2026-04-26",
    lotId: LOT_ID,
  };
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
  mockExpenseCreate.mockResolvedValue({
    id: "exp-1",
    amount: 200,
    category: "ALIMENTO",
    description: "Compra balanceado",
    date: new Date("2026-04-26"),
    lotId: LOT_ID,
    createdById: USER_ID,
  });
});

describe("POST /api/organizations/[orgSlug]/agent?action=confirm — createExpense", () => {
  it("(α1) happy path: 201 + expensesService.create invocado con args mapeados", async () => {
    const req = makeRequest({
      suggestion: { action: "createExpense", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    expect(mockExpenseCreate).toHaveBeenCalledTimes(1);
    expect(mockExpenseCreate).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        amount: 200,
        category: "ALIMENTO",
        description: "Compra balanceado",
        lotId: LOT_ID,
        createdById: USER_ID,
      }),
    );
    const callArgs = mockExpenseCreate.mock.calls[0][1] as { date: Date };
    expect(callArgs.date).toBeInstanceOf(Date);
    expect(callArgs.date.toISOString().slice(0, 10)).toBe("2026-04-26");
  });

  it("(α2) response body shape preserve { message, data }", async () => {
    const req = makeRequest({
      suggestion: { action: "createExpense", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const body = await res.json();
    expect(body.message).toBe("Gasto registrado exitosamente.");
    expect(body.data).toMatchObject({
      id: "exp-1",
      amount: 200,
      category: "ALIMENTO",
      lotId: LOT_ID,
    });
  });

  it("(α3) createdById se inyecta desde session.user.id (no desde suggestion.data)", async () => {
    const data = { ...validSuggestionData(), createdById: "ATTACKER_ID" };
    const req = makeRequest({ suggestion: { action: "createExpense", data } });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const callArgs = mockExpenseCreate.mock.calls[0][1] as { createdById: string };
    expect(callArgs.createdById).toBe(USER_ID);
    expect(callArgs.createdById).not.toBe("ATTACKER_ID");
  });

  it("(α4) description optional preserve: undefined no rompe el flow", async () => {
    const data = validSuggestionData() as Partial<ReturnType<typeof validSuggestionData>>;
    delete data.description;
    const req = makeRequest({ suggestion: { action: "createExpense", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    expect(mockExpenseCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockExpenseCreate.mock.calls[0][1] as { description?: string };
    expect(callArgs.description).toBeUndefined();
  });

  it("(α5) payload sin amount → 400 (Zod rechaza)", async () => {
    const data = validSuggestionData() as Partial<ReturnType<typeof validSuggestionData>>;
    delete data.amount;
    const req = makeRequest({ suggestion: { action: "createExpense", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockExpenseCreate).not.toHaveBeenCalled();
  });

  it("(α6) category enum out-of-range → 400", async () => {
    const data = { ...validSuggestionData(), category: "INVALID_CATEGORY" };
    const req = makeRequest({ suggestion: { action: "createExpense", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockExpenseCreate).not.toHaveBeenCalled();
  });

  it("(α7) lotId no-cuid → 400", async () => {
    const data = { ...validSuggestionData(), lotId: "not-a-cuid" };
    const req = makeRequest({ suggestion: { action: "createExpense", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockExpenseCreate).not.toHaveBeenCalled();
  });
});
