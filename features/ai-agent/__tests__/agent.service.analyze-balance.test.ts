/**
 * Tests para AgentService.analyzeBalanceSheet:
 * - Cortocircuito en balances triviales (no llama al LLM).
 * - Happy path con respuesta del LLM mockeada.
 * - Errores del LLM y respuesta vacía → outcome="error" con mensaje canned.
 * - Telemetría con mode="balance-sheet-analysis".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
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

vi.mock("@/modules/farm/presentation/server", () => ({
  LocalFarmInquiryAdapter: class {
    list = vi.fn().mockResolvedValue([]);
    findById = vi.fn().mockResolvedValue(null);
  },
  makeFarmService: vi.fn().mockReturnValue({}),
}));

vi.mock("@/modules/lot/presentation/server", () => ({
  LocalLotInquiryAdapter: class {
    list = vi.fn().mockResolvedValue([]);
    findById = vi.fn().mockResolvedValue(null);
  },
  makeLotService: vi.fn().mockReturnValue({}),
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
    (acc, a) => (a.isContra ? acc.minus(a.balance) : acc.plus(a.balance)),
    ZERO,
  );
  return { subtype, label, accounts, total };
}

function emptyCurrent(overrides: Partial<BalanceSheetCurrent> = {}): BalanceSheetCurrent {
  return {
    asOfDate: new Date("2026-04-25T00:00:00Z"),
    assets: { groups: [], total: ZERO },
    liabilities: { groups: [], total: ZERO },
    equity: { groups: [], total: ZERO, retainedEarningsOfPeriod: ZERO },
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
    ...overrides,
  };
}

function nonTrivialBalance(): BalanceSheet {
  const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
    { accountId: "a1", code: "1.1.1", name: "Caja y Bancos", balance: D("50000") },
  ]);
  const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
    { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("20000") },
  ]);
  const eq = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", [
    { accountId: "e1", code: "3.1.1", name: "Capital Social", balance: D("30000") },
  ]);
  return {
    orgId: "org_test",
    current: emptyCurrent({
      assets: { groups: [ac], total: ac.total },
      liabilities: { groups: [pc], total: pc.total },
      equity: { groups: [eq], total: eq.total, retainedEarningsOfPeriod: ZERO },
    }),
  };
}

const ORG_ID = "org_1";
const USER_ID = "user_1";

describe("AgentService.analyzeBalanceSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cortocircuita un balance vacío sin llamar al LLM y retorna trivial", async () => {
    const service = new AgentService();
    const balance: BalanceSheet = { orgId: "org_test", current: emptyCurrent() };

    const res = await service.analyzeBalanceSheet(ORG_ID, USER_ID, "contador", balance);

    expect(res).toEqual({
      status: "trivial",
      code: "empty",
      reason: expect.stringContaining("no contiene movimientos"),
    });
    expect(mockLLMQuery).not.toHaveBeenCalled();
  });

  it("cortocircuita cuando los activos son cero (no_assets)", async () => {
    const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
      { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("100") },
    ]);
    const balance: BalanceSheet = {
      orgId: "org_test",
      current: emptyCurrent({
        liabilities: { groups: [pc], total: pc.total },
        imbalanced: true,
        imbalanceDelta: D("100"),
      }),
    };

    const res = await new AgentService().analyzeBalanceSheet(
      ORG_ID,
      USER_ID,
      "contador",
      balance,
    );
    expect(res).toEqual(expect.objectContaining({ status: "trivial", code: "no_assets" }));
    expect(mockLLMQuery).not.toHaveBeenCalled();
  });

  it("retorna análisis del LLM en happy path", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "## Análisis de ratios\n\n| Ratio | Fórmula | Valor |\n| ... |",
      toolCalls: [],
      usage: { inputTokens: 800, outputTokens: 200, totalTokens: 1000 },
    });

    const res = await new AgentService().analyzeBalanceSheet(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialBalance(),
    );

    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.analysis).toContain("Análisis de ratios");
    }

    expect(mockLLMQuery).toHaveBeenCalledTimes(1);
    const call = mockLLMQuery.mock.calls[0][0];
    expect(call.tools).toEqual([]);
    expect(call.systemPrompt).toContain("Liquidez corriente");
    expect(call.userMessage).toContain("```json");
    expect(call.userMessage).toContain('"asOfDate"');
  });

  it("retorna error cuando el LLM tira excepción", async () => {
    mockLLMQuery.mockRejectedValueOnce(new Error("LLM unavailable"));

    const res = await new AgentService().analyzeBalanceSheet(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialBalance(),
    );

    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.reason).toContain("error al generar");
    }
  });

  it("trata respuesta vacía del LLM como error", async () => {
    mockLLMQuery.mockResolvedValueOnce({ text: "   ", toolCalls: [] });

    const res = await new AgentService().analyzeBalanceSheet(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialBalance(),
    );

    expect(res.status).toBe("error");
  });

  it("emite telemetría agent_invocation con mode=balance-sheet-analysis", async () => {
    mockLLMQuery.mockResolvedValueOnce({
      text: "respuesta",
      toolCalls: [],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    await new AgentService().analyzeBalanceSheet(
      ORG_ID,
      USER_ID,
      "contador",
      nonTrivialBalance(),
    );

    const calls = mockLogStructured.mock.calls
      .map((c) => c[0])
      .filter((entry) => entry.event === "agent_invocation");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      event: "agent_invocation",
      mode: "balance-sheet-analysis",
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
    await new AgentService().analyzeBalanceSheet(
      ORG_ID,
      USER_ID,
      "contador",
      { orgId: "org_test", current: emptyCurrent() },
    );

    const entry = mockLogStructured.mock.calls
      .map((c) => c[0])
      .find((e) => e.event === "agent_invocation");
    expect(entry).toMatchObject({
      mode: "balance-sheet-analysis",
      outcome: "trivial",
      trivialCode: "empty",
    });
  });
});
