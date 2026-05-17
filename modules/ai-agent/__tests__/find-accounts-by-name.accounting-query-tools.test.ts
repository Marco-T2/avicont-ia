import { describe, expect, it, vi } from "vitest";
import { executeChatMode } from "../application/modes/chat.ts";
import type { ChatMemoryPort } from "../domain/ports/chat-memory.port.ts";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port.ts";
import type { LLMProviderPort } from "../domain/ports/llm-provider.port.ts";
import type { RagPort } from "../domain/ports/rag.port.ts";
import type {
  AccountingQueryPort,
  AccountSummaryDto,
} from "../domain/ports/accounting-query.port.ts";
import {
  TOOL_REGISTRY,
  findAccountsByNameTool,
} from "../domain/tools/agent.tool-definitions.ts";

// QA fix #1 — findAccountsByName tool wiring.
//   - Resolves nombre/código de cuenta → accountId para que el agente pueda
//     encadenar getAccountBalance/getAccountMovements cuando el usuario
//     menciona la cuenta por su nombre (no por CUID).

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: AccountSummaryDto[] = [
  {
    accountId: "acc-caja-1",
    code: "1.1.1.1",
    name: "Caja General",
    type: "ACTIVO",
    isDetail: true,
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
    listPayments: async () => [],
    findAccountsByName: async (...args) => {
      capture.calls.push({ method: "findAccountsByName", args });
      return SAMPLE;
    },
    listAccounts: async () => [],
  };
}

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

describe("QA Fix #1 — findAccountsByName tool definition", () => {
  it("exported with resource:journal, action:read", () => {
    expect(findAccountsByNameTool).toBeDefined();
    expect(findAccountsByNameTool.name).toBe("findAccountsByName");
    expect(findAccountsByNameTool.resource).toBe("journal");
    expect(findAccountsByNameTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.findAccountsByName).toBe(findAccountsByNameTool);
  });

  it("inputSchema validates {query, limit?} — limit max 50", () => {
    const okMin = findAccountsByNameTool.inputSchema.safeParse({
      query: "Caja",
    });
    expect(okMin.success).toBe(true);
    const okWithLimit = findAccountsByNameTool.inputSchema.safeParse({
      query: "Caja",
      limit: 25,
    });
    expect(okWithLimit.success).toBe(true);
    const overMax = findAccountsByNameTool.inputSchema.safeParse({
      query: "Caja",
      limit: 51,
    });
    expect(overMax.success).toBe(false);
    const missingQuery = findAccountsByNameTool.inputSchema.safeParse({});
    expect(missingQuery.success).toBe(false);
  });
});

describe("QA Fix #1 — handleReadCall dispatches findAccountsByName", () => {
  it("invokes deps.accountingQuery.findAccountsByName(orgId, query, limit?)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmCapture: { history?: readonly unknown[] } = {};
    const llmProvider = makeLLMProvider(
      "findAccountsByName",
      { query: "Caja General", limit: 5 },
      llmCapture,
    );
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "saldo de Caja General",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual(["org-1", "Caja General", 5]);
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: AccountSummaryDto[] } | undefined;
    expect(toolResult?.result?.[0]?.accountId).toBe("acc-caja-1");
    expect(toolResult?.result?.[0]?.name).toBe("Caja General");
    expect(toolResult?.result?.[0]?.code).toBe("1.1.1.1");
  });

  it("omits limit when not provided (adapter applies default)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmProvider = makeLLMProvider("findAccountsByName", {
      query: "Banco",
    });
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "bancos",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual(["org-1", "Banco", undefined]);
  });
});
