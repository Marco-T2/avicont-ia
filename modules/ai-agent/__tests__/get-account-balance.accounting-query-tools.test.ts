import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountBalanceDto,
  AccountingQueryPort,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  getAccountBalanceTool,
} from "../domain/tools/agent.tool-definitions.ts";

// REQ-12 + REQ-17 — getAccountBalance tool wiring.
//   - Sentinel: empty-ledger → {balance:"0.00", asOf:null} (Marco lock).

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: AccountBalanceDto = {
  accountId: "acc-123",
  balance: "1234.56",
  asOf: "2026-05-01",
};

const EMPTY_LEDGER_SENTINEL: AccountBalanceDto = {
  accountId: "acc-empty",
  balance: "0.00",
  asOf: null,
};

function makeAccountingQueryStub(
  result: AccountBalanceDto,
  capture: { calls: Array<{ method: string; args: unknown[] }> } = { calls: [] },
): AccountingQueryPort {
  return {
    listRecentJournalEntries: async () => [],
    getAccountMovements: async () => [],
    getAccountBalance: async (...args) => {
      capture.calls.push({ method: "getAccountBalance", args });
      return result;
    },
    listSales: async () => [],
    listPurchases: async () => [],
    listPayments: async () => [],
  };
}

function makeLLMProvider(toolName: string, input: unknown): LLMProviderPort {
  return {
    query: async () => ({
      text: "ok",
      toolCalls: [{ id: "t1", name: toolName, input }],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }),
  };
}

function makeBaseDeps(accountingQuery: AccountingQueryPort) {
  const chatMemory: ChatMemoryPort = {
    findRecent: async () => [],
    append: async () => {},
  };
  const contextReader: AgentContextReaderPort = {
    findMemberIdByUserId: async () => null,
    findFarmsWithActiveLots: async () => [],
    findRecentExpenses: async () => [],
    countJournalEntries: async () => 0,
  };
  const rag: RagPort = { search: async () => [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noopInquiry: any = { list: async () => [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pricingFake: any = { calculateLotCost: async () => ({}) };
  return {
    chatMemory,
    contextReader,
    rag,
    farmInquiry: noopInquiry,
    lotInquiry: noopInquiry,
    pricingService: pricingFake,
    accountingQuery,
  };
}

describe("REQ-12 — getAccountBalance tool definition", () => {
  it("exported with resource:journal, action:read", () => {
    expect(getAccountBalanceTool).toBeDefined();
    expect(getAccountBalanceTool.name).toBe("getAccountBalance");
    expect(getAccountBalanceTool.resource).toBe("journal");
    expect(getAccountBalanceTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.getAccountBalance).toBe(getAccountBalanceTool);
  });
});

describe("REQ-12 — handleReadCall dispatches getAccountBalance", () => {
  it("invokes deps.accountingQuery.getAccountBalance(orgId, accountId)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(SAMPLE, capture);
    const llmProvider = makeLLMProvider("getAccountBalance", {
      accountId: "acc-123",
    });
    const result = await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "saldo cuenta",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual(["org-1", "acc-123"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.suggestion as any).data).toEqual(SAMPLE);
  });

  it("empty-ledger sentinel: passes through {balance:'0.00', asOf:null}", async () => {
    const accountingQuery = makeAccountingQueryStub(EMPTY_LEDGER_SENTINEL);
    const llmProvider = makeLLMProvider("getAccountBalance", {
      accountId: "acc-empty",
    });
    const result = await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "saldo cuenta vacía",
        surface: "sidebar-qa",
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.suggestion as any).data).toEqual(EMPTY_LEDGER_SENTINEL);
  });
});
