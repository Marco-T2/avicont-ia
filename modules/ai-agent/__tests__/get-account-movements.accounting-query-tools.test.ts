import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountingQueryPort,
  LedgerEntryDto,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  getAccountMovementsTool,
} from "../domain/tools/agent.tool-definitions.ts";

// REQ-11 + REQ-17 — getAccountMovements tool wiring.

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: LedgerEntryDto[] = [
  {
    entryId: "je-1",
    date: "2026-05-01",
    displayNumber: "D2605-000001",
    description: "Cobranza",
    debit: "100.00",
    credit: "0.00",
    balance: "100.00",
  },
];

function makeAccountingQueryStub(
  capture: { calls: Array<{ method: string; args: unknown[] }> } = { calls: [] },
): AccountingQueryPort {
  return {
    listRecentJournalEntries: async () => [],
    getAccountMovements: async (...args) => {
      capture.calls.push({ method: "getAccountMovements", args });
      return SAMPLE;
    },
    getAccountBalance: async () => ({
      accountId: "",
      balance: "0.00",
      asOf: null,
    }),
    listSales: async () => [],
    listPurchases: async () => [],
    listPayments: async () => [],
    findAccountsByName: async () => [],
    listAccounts: async () => [],
  };
}

/** Multi-turn LLM mock (REQ-19) — see sister test get-account-balance for pattern. */
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

describe("REQ-11 — getAccountMovements tool definition", () => {
  it("exported with resource:journal, action:read", () => {
    expect(getAccountMovementsTool).toBeDefined();
    expect(getAccountMovementsTool.name).toBe("getAccountMovements");
    expect(getAccountMovementsTool.resource).toBe("journal");
    expect(getAccountMovementsTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.getAccountMovements).toBe(getAccountMovementsTool);
  });
});

describe("REQ-11 — handleReadCall dispatches getAccountMovements", () => {
  it("invokes deps.accountingQuery.getAccountMovements(orgId, accountId, dateFrom?, dateTo?)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmCapture: { history?: readonly unknown[] } = {};
    const llmProvider = makeLLMProvider(
      "getAccountMovements",
      {
        accountId: "acc-123",
        dateFrom: "2026-01-01",
        dateTo: "2026-05-01",
      },
      llmCapture,
    );
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "movimientos cuenta",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls).toHaveLength(1);
    expect(capture.calls[0].args).toEqual([
      "org-1",
      "acc-123",
      "2026-01-01",
      "2026-05-01",
      undefined, // limit (default-10 aplicado en el adapter cuando undefined)
    ]);
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: unknown } | undefined;
    expect(toolResult?.result).toEqual(SAMPLE);
  });
});
