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
  listAccountsTool,
} from "../domain/tools/agent.tool-definitions.ts";

// QA fix #1 — listAccounts tool wiring.
//   - Lista cuentas filtrables por type / isDetail. Útil para preguntas
//     abiertas como "qué cajas tengo" / "qué bancos hay".

vi.mock("@/lib/logging/structured", () => ({
  logStructured: () => {},
}));

const SAMPLE: AccountSummaryDto[] = [
  {
    accountId: "acc-1",
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
    findAccountsByName: async () => [],
    listAccounts: async (...args) => {
      capture.calls.push({ method: "listAccounts", args });
      return SAMPLE;
    },
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

describe("QA Fix #1 — listAccounts tool definition", () => {
  it("exported with resource:journal, action:read", () => {
    expect(listAccountsTool).toBeDefined();
    expect(listAccountsTool.name).toBe("listAccounts");
    expect(listAccountsTool.resource).toBe("journal");
    expect(listAccountsTool.action).toBe("read");
  });

  it("registered in TOOL_REGISTRY", () => {
    expect(TOOL_REGISTRY.listAccounts).toBe(listAccountsTool);
  });

  it("inputSchema accepts optional {type?, isDetail?, limit?} — all may be omitted", () => {
    const empty = listAccountsTool.inputSchema.safeParse({});
    expect(empty.success).toBe(true);
    const withFilters = listAccountsTool.inputSchema.safeParse({
      type: "ACTIVO",
      isDetail: true,
      limit: 30,
    });
    expect(withFilters.success).toBe(true);
    const overMax = listAccountsTool.inputSchema.safeParse({ limit: 51 });
    expect(overMax.success).toBe(false);
    const badType = listAccountsTool.inputSchema.safeParse({
      type: "FOOBAR",
    });
    expect(badType.success).toBe(false);
  });
});

describe("QA Fix #1 — handleReadCall dispatches listAccounts", () => {
  it("invokes deps.accountingQuery.listAccounts(orgId, type?, isDetail?, limit?)", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmCapture: { history?: readonly unknown[] } = {};
    const llmProvider = makeLLMProvider(
      "listAccounts",
      { type: "ACTIVO", isDetail: true, limit: 30 },
      llmCapture,
    );
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "qué cajas tengo",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual(["org-1", "ACTIVO", true, 30]);
    const toolResult = (llmCapture.history ?? []).find(
      (t) => (t as { kind: string }).kind === "tool_result",
    ) as { result: AccountSummaryDto[] } | undefined;
    expect(toolResult?.result?.[0]?.code).toBe("1.1.1.1");
  });

  it("dispatches with all filters undefined when input is empty", async () => {
    const capture: { calls: Array<{ method: string; args: unknown[] }> } = {
      calls: [],
    };
    const accountingQuery = makeAccountingQueryStub(capture);
    const llmProvider = makeLLMProvider("listAccounts", {});
    await executeChatMode(
      { llmProvider, ...makeBaseDeps(accountingQuery) },
      {
        orgId: "org-1",
        userId: "u-1",
        role: "contador",
        prompt: "lista cuentas",
        surface: "sidebar-qa",
      },
    );
    expect(capture.calls[0].args).toEqual([
      "org-1",
      undefined,
      undefined,
      undefined,
    ]);
  });
});
