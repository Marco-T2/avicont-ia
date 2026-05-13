/**
 * Tests para POST /api/organizations/[orgSlug]/financial-statements/balance-sheet/analyze
 *
 * Cobertura:
 *  - 403 cuando requirePermission rechaza
 *  - 400 cuando el body falla validación Zod
 *  - 429 cuando el rate limit corta
 *  - 200 status:trivial cuando el balance es trivial
 *  - 200 status:ok cuando el LLM devuelve análisis
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/features/shared/errors";

const {
  mockRequirePermission,
  mockGetMember,
  mockGenerate,
  mockAnalyze,
  mockRateCheck,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetMember: vi.fn(),
  mockGenerate: vi.fn(),
  mockAnalyze: vi.fn(),
  mockRateCheck: vi.fn(),
}));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; statusCode: number };
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

vi.mock("@/modules/organizations/presentation/server", () => ({
  makeOrganizationsService: () => ({
    getMemberWithUserByClerkUserId: mockGetMember,
  }),
}));

vi.mock("@/modules/accounting/financial-statements/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/accounting/financial-statements/presentation/server")
  >();
  class FinancialStatementsServiceMock {
    generateBalanceSheet = mockGenerate;
  }
  return {
    ...actual,
    FinancialStatementsService: FinancialStatementsServiceMock,
    makeFinancialStatementsService: () => new FinancialStatementsServiceMock(),
  };
});

vi.mock("@/modules/ai-agent/presentation/server", () => {
  class AgentServiceMock {
    analyzeBalanceSheet = mockAnalyze;
  }
  class AgentRateLimitServiceMock {
    check = mockRateCheck;
  }
  return {
    AgentService: AgentServiceMock,
    AgentRateLimitService: AgentRateLimitServiceMock,
    makeAgentService: () => new AgentServiceMock(),
    makeAgentRateLimitService: () => new AgentRateLimitServiceMock(),
  };
});

import { POST } from "../route";

const ORG_SLUG = "acme";
const ORG_ID = "org_1";
const USER_ID = "user_1";
const VALID_BODY = { date: "2026-04-25" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/x/y/z", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    session: { userId: "clerk_1" },
    orgId: ORG_ID,
    role: "contador",
  });
  mockGetMember.mockResolvedValue({
    user: { id: USER_ID },
    role: "contador",
  });
  mockRateCheck.mockResolvedValue({ allowed: true });
  mockGenerate.mockResolvedValue({
    orgId: ORG_ID,
    current: {
      asOfDate: new Date(),
      assets: { groups: [], total: { isZero: () => true } },
      liabilities: { groups: [], total: { isZero: () => true } },
      equity: { groups: [], total: { isZero: () => true }, retainedEarningsOfPeriod: {} },
      imbalanced: false,
      imbalanceDelta: {},
      preliminary: false,
    },
  });
  mockAnalyze.mockResolvedValue({ status: "ok", analysis: "## Análisis\n..." });
});

describe("POST balance-sheet/analyze", () => {
  it("retorna 403 cuando requirePermission rechaza", async () => {
    mockRequirePermission.mockRejectedValueOnce(
      new ForbiddenError("No tienes permiso"),
    );

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(403);
  });

  it("retorna 400 cuando falta date en el body", async () => {
    const res = await POST(makeRequest({}), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(400);
  });

  it("retorna 429 cuando el rate limit del usuario corta", async () => {
    mockRateCheck.mockResolvedValueOnce({
      allowed: false,
      scope: "user",
      limit: 60,
      retryAfterSeconds: 1800,
    });

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("1800");
    const json = await res.json();
    expect(json.error).toBe("rate_limit_exceeded");
    expect(json.scope).toBe("user");
  });

  it("retorna 200 con status:trivial cuando el análisis es trivial", async () => {
    mockAnalyze.mockResolvedValueOnce({
      status: "trivial",
      code: "empty",
      reason: "El Balance General no contiene movimientos en el período seleccionado.",
    });

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      status: "trivial",
      code: "empty",
      reason: expect.any(String),
    });
  });

  it("retorna 200 con análisis del LLM en happy path", async () => {
    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.analysis).toContain("Análisis");

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyze.mock.calls[0][0]).toBe(ORG_ID);
    expect(mockAnalyze.mock.calls[0][1]).toBe(USER_ID);
  });

  it("requiere permission reports:read", async () => {
    await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(mockRequirePermission).toHaveBeenCalledWith("reports", "read", ORG_SLUG);
  });
});
