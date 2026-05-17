import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountingQueryPort,
  JournalEntrySummaryDto,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  listRecentJournalEntriesTool,
} from "../domain/tools/agent.tool-definitions.ts";

// REQ-10 + REQ-17 + REQ-18 — listRecentJournalEntries tool wiring.
// RED failure modes (per task plan):
//   1. Import error: `listRecentJournalEntriesTool` doesn't exist yet.
//   2. switch-default branch returns "Acción no reconocida" (handler test).
//   3. sentinel RED if tool registered without bundle (covered separately).

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: JournalEntrySummaryDto[] = [
  {
    id: "je-1",
    date: "2026-05-01",
    displayNumber: "D2605-000001",
    description: "Apertura",
    status: "POSTED",
    totalDebit: "100.00",
    totalCredit: "100.00",
  },
];

function makeAccountingQueryStub(
  capture: { calls: Array<{ method: string; args: unknown[] }> } = { calls: [] },
): AccountingQueryPort {
  return {
    listRecentJournalEntries: async (...args) => {
      capture.calls.push({ method: "listRecentJournalEntries", args });
      return SAMPLE;
    },
    getAccountMovements: async () => [],
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

describe("REQ-10 SCN-10.1 — listRecentJournalEntries tool definition", () => {
  it("listRecentJournalEntriesTool is exported with resource:journal, action:read", () => {
    expect(listRecentJournalEntriesTool).toBeDefined();
    expect(listRecentJournalEntriesTool.name).toBe("listRecentJournalEntries");
    expect(listRecentJournalEntriesTool.resource).toBe("journal");
    expect(listRecentJournalEntriesTool.action).toBe("read");
  });

  it("listRecentJournalEntriesTool is registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.listRecentJournalEntries).toBe(
      listRecentJournalEntriesTool,
    );
  });
});

describe("REQ-10 — handleReadCall dispatches listRecentJournalEntries", () => {
  it("invokes deps.accountingQuery.listRecentJournalEntries(orgId, limit)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmProvider = makeLLMProvider("listRecentJournalEntries", {
      limit: 5,
    });
    const result = await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "muéstrame asientos",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls).toHaveLength(1);
    expect(capture.calls[0].method).toBe("listRecentJournalEntries");
    expect(capture.calls[0].args[0]).toBe("org-1");
    expect(capture.calls[0].args[1]).toBe(5);
    // suggestion.data must surface the DTO array
    expect(result.suggestion).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.suggestion as any).data).toEqual(SAMPLE);
  });

  it("uses default limit=10 when args.limit omitted", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmProvider = makeLLMProvider("listRecentJournalEntries", {});
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "asientos recientes",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args[1]).toBe(10);
  });
});
