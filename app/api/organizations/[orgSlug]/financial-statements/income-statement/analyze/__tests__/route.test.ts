/**
 * Tests para POST /api/organizations/[orgSlug]/financial-statements/income-statement/analyze
 *
 * Cobertura:
 *  - 403 cuando requirePermission rechaza
 *  - 400 cuando el body falla validación Zod
 *  - 429 cuando el rate limit corta
 *  - 200 status:trivial cuando el estado es trivial
 *  - 200 status:ok cuando el LLM devuelve análisis
 *  - BG cruzado se genera con asOfDate = is.current.dateTo (verificación clave)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/features/shared/errors";

const {
  mockRequirePermission,
  mockGetMember,
  mockGenerateIs,
  mockGenerateBs,
  mockAnalyze,
  mockRateCheck,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetMember: vi.fn(),
  mockGenerateIs: vi.fn(),
  mockGenerateBs: vi.fn(),
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
    generateIncomeStatement = mockGenerateIs;
    generateBalanceSheet = mockGenerateBs;
  }
  return {
    ...actual,
    FinancialStatementsService: FinancialStatementsServiceMock,
    makeFinancialStatementsService: () => new FinancialStatementsServiceMock(),
  };
});

vi.mock("@/modules/ai-agent/presentation/server", () => {
  class AgentServiceMock {
    analyzeIncomeStatement = mockAnalyze;
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
const VALID_BODY = { dateFrom: "2026-01-01", dateTo: "2026-06-30" };
const IS_DATE_TO = new Date("2026-06-30T00:00:00Z");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/x/y/z", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const incomeStatementMock = {
  orgId: ORG_ID,
  current: {
    dateFrom: new Date("2026-01-01T00:00:00Z"),
    dateTo: IS_DATE_TO,
    income: { groups: [], total: { isZero: () => false } },
    expenses: { groups: [], total: { isZero: () => false } },
    operatingIncome: {},
    netIncome: {},
    preliminary: false,
  },
};

const balanceSheetMock = {
  orgId: ORG_ID,
  current: {
    asOfDate: IS_DATE_TO,
    assets: { groups: [], total: { isZero: () => false } },
    liabilities: { groups: [], total: { isZero: () => false } },
    equity: { groups: [], total: { isZero: () => false }, retainedEarningsOfPeriod: {} },
    imbalanced: false,
    imbalanceDelta: {},
    preliminary: false,
  },
};

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
  mockGenerateIs.mockResolvedValue(incomeStatementMock);
  mockGenerateBs.mockResolvedValue(balanceSheetMock);
  mockAnalyze.mockResolvedValue({ status: "ok", analysis: "## Análisis\n..." });
});

describe("POST income-statement/analyze", () => {
  it("retorna 403 cuando requirePermission rechaza", async () => {
    mockRequirePermission.mockRejectedValueOnce(
      new ForbiddenError("No tienes permiso"),
    );
    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(403);
  });

  it("retorna 400 cuando faltan periodId/preset/dateFrom+dateTo", async () => {
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
      code: "no_activity",
      reason: "El estado no presenta actividad financiera en el período seleccionado.",
    });
    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      status: "trivial",
      code: "no_activity",
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
    expect(mockGenerateIs).toHaveBeenCalledTimes(1);
    expect(mockGenerateBs).toHaveBeenCalledTimes(1);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  it("genera el BG cruzado con asOfDate = IS.current.dateTo (no redondeado)", async () => {
    await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(mockGenerateBs).toHaveBeenCalledTimes(1);
    const bgInput = mockGenerateBs.mock.calls[0][2];
    expect(bgInput.asOfDate).toBe(IS_DATE_TO);
  });

  it("pasa current del IS y current del BG al agente", async () => {
    await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(mockAnalyze).toHaveBeenCalledWith(
      ORG_ID,
      USER_ID,
      "contador",
      incomeStatementMock.current,
      balanceSheetMock.current,
    );
  });

  it("requiere permission reports:read", async () => {
    await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(mockRequirePermission).toHaveBeenCalledWith("reports", "read", ORG_SLUG);
  });
});
