import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountingQueryPort,
  PurchaseSummaryDto,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  listPurchasesTool,
} from "../domain/tools/agent.tool-definitions.ts";

// REQ-14 + REQ-17 + REQ-18 — listPurchases tool wiring.

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: PurchaseSummaryDto[] = [
  {
    id: "purch-1",
    date: "2026-05-01",
    sequenceNumber: 17,
    status: "POSTED",
    purchaseType: "COMPRA_GENERAL",
    contactId: "ctx-1",
    description: "Compra mayo",
    totalAmount: "777.77",
  },
];

function makeAccountingQueryStub(
  capture: { calls: Array<{ method: string; args: unknown[] }> } = { calls: [] },
): AccountingQueryPort {
  return {
    listRecentJournalEntries: async () => [],
    getAccountMovements: async () => [],
    getAccountBalance: async () => ({
      accountId: "",
      balance: "0.00",
      asOf: null,
    }),
    listSales: async () => [],
    listPurchases: async (...args) => {
      capture.calls.push({ method: "listPurchases", args });
      return SAMPLE;
    },
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

describe("REQ-14 — listPurchases tool definition", () => {
  it("exported with resource:purchases, action:read", () => {
    expect(listPurchasesTool).toBeDefined();
    expect(listPurchasesTool.name).toBe("listPurchases");
    expect(listPurchasesTool.resource).toBe("purchases");
    expect(listPurchasesTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.listPurchases).toBe(listPurchasesTool);
  });
});

describe("REQ-14 + REQ-18 — handleReadCall dispatches listPurchases", () => {
  it("invokes deps.accountingQuery.listPurchases(orgId, dateFrom?, dateTo?, limit)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmProvider = makeLLMProvider("listPurchases", { limit: 8 });
    const result = await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "compras",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual([
      "org-1",
      undefined,
      undefined,
      8,
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (result.suggestion as any).data as PurchaseSummaryDto[];
    expect(data[0].totalAmount).toBe("777.77");
  });
});
