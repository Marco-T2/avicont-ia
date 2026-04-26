/**
 * Tests para AgentService.analyzeIncomeStatement:
 * - Cortocircuito en estados triviales (no_activity, no_revenue, imbalanced_bs).
 * - Happy path con respuesta del LLM mockeada.
 * - Errores del LLM y respuesta vacía → outcome="error" con mensaje canned.
 * - Telemetría con mode="income-statement-analysis".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type {
  BalanceSheetCurrent,
  IncomeStatementCurrent,
  SubtypeGroup,
} from "@/features/accounting/financial-statements/financial-statements.types";

const { mockLLMQuery, mockLogStructured } = vi.hoisted(() => ({
  mockLLMQuery: vi.fn(),
  mockLogStructured: vi.fn(),
}));

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key-for-vitest";
});

vi.mock("@/lib/logging/structured", () => ({
  logStructured: mockLogStructured,
}));

vi.mock("../memory.repository", () => ({
  ChatMemoryRepository: class {
    saveMessage = vi.fn();
    getRecentMessages = vi.fn().mockResolvedValue([]);
    clearSession = vi.fn();
  },
}));

vi.mock("../llm", async () => {
  const actual = await vi.importActual<typeof import("../llm")>("../llm");
  return {
    ...actual,
    llmClient: { query: mockLLMQuery },
  };
});

vi.mock("../agent.context", () => ({
  buildAgentContext: vi.fn().mockResolvedValue(""),
  buildRagContext: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/features/farms/server", () => ({
  FarmsService: class {
    list = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/features/lots/server", () => ({
  LotsService: class {
    listByFarm = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/features/pricing/server", () => ({
  PricingService: class {
    calculateLotCost = vi.fn().mockResolvedValue({});
  },
}));

import { AgentService } from "../agent.service";

const D = (v: string | number) => new Prisma.Decimal(v);
const ZERO = D(0);

function group(
  subtype: AccountSubtype,
  label: string,
  accounts: SubtypeGroup["accounts"],
): SubtypeGroup {
  const total = accounts.reduce<Prisma.Decimal>(
    (acc, a) => acc.plus(a.balance),
    ZERO,
  );
  return { subtype, label, accounts, total };
}

function emptyIs(overrides: Partial<IncomeStatementCurrent> = {}): IncomeStatementCurrent {
  return {
    dateFrom: new Date("2026-01-01T00:00:00Z"),
    dateTo: new Date("2026-06-30T00:00:00Z"),
    income: { groups: [], total: ZERO },
    expenses: { groups: [], total: ZERO },
    operatingIncome: ZERO,
    netIncome: ZERO,
    preliminary: false,
    ...overrides,
  };
}

function healthyBg(overrides: Partial<BalanceSheetCurrent> = {}): BalanceSheetCurrent {
  const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
    { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("5300000") },
  ]);
  const eq = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", [
    { accountId: "e1", code: "3.1.1", name: "Capital", balance: D("2450000") },
  ]);
  return {
    asOfDate: new Date("2026-06-30T00:00:00Z"),
    assets: { groups: [ac], total: D("5300000") },
    liabilities: { groups: [], total: D("2850000") },
    equity: { groups: [eq], total: D("2450000"), retainedEarningsOfPeriod: ZERO },
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
    ...overrides,
  };
}

function nonTrivialIs(): IncomeStatementCurrent {
  const ingOp = group(AccountSubtype.INGRESO_OPERATIVO, "Ingresos Operativos", [
    { accountId: "i1", code: "4.1.01", name: "Venta", balance: D("1800000") },
  ]);
  const gOp = group(AccountSubtype.GASTO_OPERATIVO, "Gastos Operativos", [
    { accountId: "g1", code: "5.1.01", name: "Insumos", balance: D("1160000") },
  ]);
  const incomeTotal = ingOp.total;
  const expensesTotal = gOp.total;
  return {
    dateFrom: new Date("2026-01-01T00:00:00Z"),
    dateTo: new Date("2026-06-30T00:00:00Z"),
    income: { groups: [ingOp], total: incomeTotal },
    expenses: { groups: [gOp], total: expensesTotal },
    operatingIncome: ingOp.total.minus(gOp.total),
    netIncome: incomeTotal.minus(expensesTotal),
    preliminary: false,
  };
}

const ORG_ID = "org_1";
const USER_ID = "user_1";

describe("AgentService.analyzeIncomeStatement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cortocircuita estado sin actividad sin llamar al LLM", async () => {
    const service = new AgentService();
    const res = await service.analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      emptyIs(),
      healthyBg(),
    );
    expect(res).toEqual({
      trivial: undefined,
      status: "trivial",
      code: "no_activity",
      reason: expect.stringContaining("no presenta actividad"),
    });
    expect(mockLLMQuery).not.toHaveBeenCalled();
  });

  it("cortocircuita cuando solo hay gastos (no_revenue)", async () => {
    const gOp = group(AccountSubtype.GASTO_OPERATIVO, "Gastos", [
      { accountId: "g1", code: "5.1.1", name: "Insumos", balance: D("1000") },
    ]);
    const is = emptyIs({
      expenses: { groups: [gOp], total: gOp.total },
      netIncome: gOp.total.negated(),
    });
    const res = await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      is,
      healthyBg(),
    );
    expect(res).toEqual(expect.objectContaining({ status: "trivial", code: "no_revenue" }));
    expect(mockLLMQuery).not.toHaveBeenCalled();
  });

  it("cortocircuita cuando el BG cruzado tiene descuadre >10%", async () => {
    const bg = healthyBg({ imbalanced: true, imbalanceDelta: D("700000") });
    const res = await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialIs(),
      bg,
    );
    expect(res).toEqual(expect.objectContaining({ status: "trivial", code: "imbalanced_bs" }));
    expect(mockLLMQuery).not.toHaveBeenCalled();
  });

  it("retorna análisis del LLM en happy path", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "**Síntesis del período**\n\n| Ratio | Fórmula | Valor | Interpretación breve |\n| ... |",
      toolCalls: [],
      usage: { inputTokens: 800, outputTokens: 300, totalTokens: 1100 },
    });

    const res = await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialIs(),
      healthyBg(),
    );

    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.analysis).toContain("Síntesis del período");
    }

    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
    const call = mockLLMQuery.mock.calls[0][0];
    expect(call.tools).toEqual([]);
    expect(call.systemPrompt).toContain("NO recalcules los ratios");
    expect(call.userMessage).toContain("```json");
    expect(call.userMessage).toContain('"operatingMargin"');
  });

  it("retorna error cuando el LLM tira excepción", async () => {
    mockLLMQuery.mockRejectedValueOnce(new Error("LLM unavailable"));
    const res = await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialIs(),
      healthyBg(),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.reason).toContain("error al generar");
    }
  });

  it("trata respuesta vacía del LLM como error", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "   ", toolCalls: [] });
    const res = await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialIs(),
      healthyBg(),
    );
    expect(res.status).toBe("error");
  });

  it("emite telemetría agent_invocation con mode=income-statement-analysis", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "respuesta",
      toolCalls: [],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialIs(),
      healthyBg(),
    );

    const calls = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((entry) => entry.event === "agent_invocation");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      event: "agent_invocation",
      mode: "income-statement-analysis",
      orgId: ORG_ID,
      userId: USER_ID,
      role: "contador",
      outcome: "ok",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
  });

  it("registra outcome=trivial con trivialCode en telemetría", async () => {
    await new AgentService().analyzeIncomeStatement(
      ORG_ID,
      USER_ID,
      "contador",
      emptyIs(),
      healthyBg(),
    );
    const entry = mockLogStructured.mock.calls
      .map((c) => c[0])
      .find((e) => e.event === "agent_invocation");
    expect(entry).toMatchObject({
      mode: "income-statement-analysis",
      outcome: "trivial",
      trivialCode: "no_activity",
    });
  });
});
