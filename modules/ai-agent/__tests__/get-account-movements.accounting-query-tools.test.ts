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
    const llmProvider = makeLLMProvider("getAccountMovements", {
      accountId: "acc-123",
      dateFrom: "2026-01-01",
      dateTo: "2026-05-01",
    });
    const result = await executeChatMode(
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
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.suggestion as any).data).toEqual(SAMPLE);
  });
});
