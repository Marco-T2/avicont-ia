import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountingQueryPort,
  SaleSummaryDto,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  listSalesTool,
} from "../domain/tools/agent.tool-definitions.ts";

// REQ-13 + REQ-17 + REQ-18 — listSales tool wiring + MonetaryAmount serialization.

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: SaleSummaryDto[] = [
  {
    id: "sale-1",
    date: "2026-05-01",
    sequenceNumber: 42,
    status: "POSTED",
    contactId: "ctx-1",
    description: "Venta de mayo",
    totalAmount: "1234.50",
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
    listSales: async (...args) => {
      capture.calls.push({ method: "listSales", args });
      return SAMPLE;
    },
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

describe("REQ-13 — listSales tool definition", () => {
  it("exported with resource:sales, action:read", () => {
    expect(listSalesTool).toBeDefined();
    expect(listSalesTool.name).toBe("listSales");
    expect(listSalesTool.resource).toBe("sales");
    expect(listSalesTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.listSales).toBe(listSalesTool);
  });
});

describe("REQ-13 + REQ-18 — handleReadCall dispatches listSales", () => {
  it("invokes deps.accountingQuery.listSales(orgId, dateFrom?, dateTo?, limit)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmCapture: { history?: readonly unknown[] } = {};
    const llmProvider = makeLLMProvider(
      "listSales",
      { limit: 5, dateFrom: "2026-01-01" },
      llmCapture,
    );
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "ventas",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual([
      "org-1",
      "2026-01-01",
      undefined,
      5,
    ]);
    // REQ-18: totalAmount is a roundHalfUp(...).toFixed(2) string. Post-REQ-19
    // the DTO surfaces via ToolResultTurn in conversationHistory.
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: SaleSummaryDto[] } | undefined;
    expect(toolResult?.result?.[0]?.totalAmount).toBe("1234.50");
  });

  it("uses default limit=20 when args.limit omitted", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmProvider = makeLLMProvider("listSales", {});
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "ventas",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args[3]).toBe(20);
  });
});
