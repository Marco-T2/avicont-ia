import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountingQueryPort,
  PaymentSummaryDto,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  listPaymentsTool,
} from "../domain/tools/agent.tool-definitions.ts";

// REQ-15 + REQ-17 + REQ-18 — listPayments tool wiring.
//   - contactId fallback (Marco lock): when PaymentsService doesn't expose
//     a denormalized counterparty name, the DTO surfaces the raw contactId
//     string. Test asserts the field is present as a string.

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: PaymentSummaryDto[] = [
  {
    id: "pay-1",
    date: "2026-05-01",
    status: "POSTED",
    method: "EFECTIVO",
    direction: "COBRO",
    contactId: "ctx-1",
    contactName: "Distribuidora El Sol SRL",
    amount: "99.90",
    description: "Cobranza Mayo",
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
    listPurchases: async () => [],
    listPayments: async (...args) => {
      capture.calls.push({ method: "listPayments", args });
      return SAMPLE;
    },
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

describe("REQ-15 — listPayments tool definition", () => {
  it("exported with resource:payments, action:read", () => {
    expect(listPaymentsTool).toBeDefined();
    expect(listPaymentsTool.name).toBe("listPayments");
    expect(listPaymentsTool.resource).toBe("payments");
    expect(listPaymentsTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.listPayments).toBe(listPaymentsTool);
  });
});

describe("REQ-15 + REQ-18 — handleReadCall dispatches listPayments", () => {
  it("invokes deps.accountingQuery.listPayments(orgId, dateFrom?, dateTo?, limit) and surfaces direction + contactId", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmCapture: { history?: readonly unknown[] } = {};
    const llmProvider = makeLLMProvider(
      "listPayments",
      { limit: 3 },
      llmCapture,
    );
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "cobrador",
        prompt: "cobranzas",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual([
      "org-1",
      undefined,
      undefined,
      3,
    ]);
    // Post-REQ-19: DTO surfaces via ToolResultTurn in conversationHistory.
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: PaymentSummaryDto[] } | undefined;
    const data = toolResult?.result;
    expect(data?.[0]?.amount).toBe("99.90");
    expect(data?.[0]?.direction).toBe("COBRO");
    // QA Fix #3 — contactName is now propagated (no más UUID raw en respuestas).
    expect(data?.[0]?.contactName).toBe("Distribuidora El Sol SRL");
    // contactId still preserved for downstream consumers.
    expect(typeof data?.[0]?.contactId).toBe("string");
    expect(data?.[0]?.contactId).toBe("ctx-1");
  });
});
