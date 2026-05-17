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

/**
 * Multi-turn LLM mock (REQ-19 contract). Turn 1 emits the tool_call so the
 * loop dispatches the tool; turn 2 returns text-only so the loop exits.
 * `capture.history` records the conversationHistory passed to the FINAL
 * (text-only) LLM call so tests can assert that the ToolResultTurn carries
 * the expected DTO payload.
 */
function makeLLMProvider(
  toolName: string,
  input: unknown,
  capture: { history?: readonly unknown[] } = {},
): LLMProviderPort {
  let turn = 0;
  return {
    query: async ({ conversationHistory }) => {
      turn += 1;
      if (turn === 1) {
        return {
          text: "",
          toolCalls: [{ id: "t1", name: toolName, input }],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      }
      capture.history = conversationHistory;
      return {
        text: "respuesta natural",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    },
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

describe("REQ-12 — executeChatMode dispatches getAccountBalance through multi-turn loop", () => {
  it("invokes deps.accountingQuery.getAccountBalance(orgId, accountId) and feeds DTO to LLM turn 2", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const llmCapture: { history?: readonly unknown[] } = {};
    const accountingQuery = makeAccountingQueryStub(SAMPLE, capture);
    const llmProvider = makeLLMProvider(
      "getAccountBalance",
      { accountId: "acc-123" },
      llmCapture,
    );
    await executeChatMode(
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
    // Post-REQ-19: DTO surfaces via ToolResultTurn in conversationHistory,
    // not via response.suggestion.data (the placeholder contract is GONE).
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: unknown } | undefined;
    expect(toolResult?.result).toEqual(SAMPLE);
  });

  it("empty-ledger sentinel: passes through {balance:'0.00', asOf:null} via ToolResultTurn", async () => {
    const llmCapture: { history?: readonly unknown[] } = {};
    const accountingQuery = makeAccountingQueryStub(EMPTY_LEDGER_SENTINEL);
    const llmProvider = makeLLMProvider(
      "getAccountBalance",
      { accountId: "acc-empty" },
      llmCapture,
    );
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "saldo cuenta vacía",
        surface: "sidebar-qa",
      },
    );
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: unknown } | undefined;
    expect(toolResult?.result).toEqual(EMPTY_LEDGER_SENTINEL);
  });
});
