/**
 * Smoke test for the neutral LLM wrapper (llm/gemini.ts).
 *
 * Goal: lock the contract before the rest of the agent code migrates to it.
 * If any of these break, the refactor of agent.tools.ts and agent.service.ts
 * will sit on top of a broken foundation.
 *
 * What we cover:
 *   1. Happy path: a Zod-defined tool round-trips through the adapter to a
 *      JSON-Schema FunctionDeclaration the Gemini SDK receives.
 *   2. Function-only response: empty text + ToolCall[] with synthesized id.
 *   3. Multiple function calls: returned as an array (no silent drop of [0]).
 *   4. Empty tools list: SDK called with `tools: undefined`, not [].
 *   5. response.text() throwing: logStructured fired (carry-over from old test).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetGenerativeModel: vi.fn(),
}));

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key-for-vitest";
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = (config: unknown) => {
      mockGetGenerativeModel(config);
      return { generateContent: mockGenerateContent };
    };
  },
}));

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { llmClient, defineTool, analyzeDocument } from "../index";
import { logStructured } from "@/lib/logging/structured";

beforeEach(() => {
  vi.mocked(logStructured).mockClear();
  mockGenerateContent.mockReset();
  mockGetGenerativeModel.mockReset();
});

type FakeResponse = {
  text: () => string;
  functionCalls: () => unknown[] | undefined;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function fakeResult(overrides: Partial<FakeResponse>) {
  return {
    response: {
      text: overrides.text ?? (() => ""),
      functionCalls: overrides.functionCalls ?? (() => undefined),
      usageMetadata: overrides.usageMetadata,
    },
  };
}

const fakeTool = defineTool({
  name: "echo",
  description: "Echo a message back",
  inputSchema: z.object({
    message: z.string().describe("Message to echo"),
    times: z.number().int().optional(),
  }),
});

describe("LLMClient (gemini) — wrapper smoke tests", () => {
  it("happy path: returns text and empty toolCalls array", async () => {
    mockGenerateContent.mockResolvedValue(
      fakeResult({ text: () => "hola mundo" }),
    );

    const result = await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [fakeTool],
    });

    expect(result.text).toBe("hola mundo");
    expect(result.toolCalls).toEqual([]);
  });

  it("converts Zod tool to JSON-Schema FunctionDeclaration without leaking $schema or additionalProperties", async () => {
    mockGenerateContent.mockResolvedValue(fakeResult({ text: () => "ok" }));

    await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [fakeTool],
    });

    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
    const config = mockGetGenerativeModel.mock.calls[0][0];
    const fnDecls = config.tools[0].functionDeclarations;
    expect(fnDecls).toHaveLength(1);
    expect(fnDecls[0].name).toBe("echo");
    expect(fnDecls[0].description).toBe("Echo a message back");

    const params = fnDecls[0].parameters;
    expect(params.type).toBe("object");
    expect(params.properties.message.type).toBe("string");
    expect(params.properties.message.description).toBe("Message to echo");
    expect(params.required).toEqual(["message"]);
    expect(params).not.toHaveProperty("$schema");
    expect(params).not.toHaveProperty("additionalProperties");
  });

  it("function-only response: empty text + ToolCall with synthesized id", async () => {
    const calls = [{ name: "echo", args: { message: "hi" } }];
    mockGenerateContent.mockResolvedValue(
      fakeResult({ text: () => "", functionCalls: () => calls }),
    );

    const result = await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [fakeTool],
    });

    expect(result.text).toBe("");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("echo");
    expect(result.toolCalls[0].input).toEqual({ message: "hi" });
    expect(result.toolCalls[0].id).toMatch(/^gem_\d+_0$/);
  });

  it("multiple function calls: returns the full array (regression guard against [0]-only handling)", async () => {
    const calls = [
      { name: "listFarms", args: {} },
      { name: "listLots", args: { farmId: "f1" } },
      { name: "echo", args: { message: "x" } },
    ];
    mockGenerateContent.mockResolvedValue(
      fakeResult({ text: () => "", functionCalls: () => calls }),
    );

    const result = await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [fakeTool],
    });

    expect(result.toolCalls).toHaveLength(3);
    expect(result.toolCalls.map((c) => c.name)).toEqual([
      "listFarms",
      "listLots",
      "echo",
    ]);
  });

  it("empty tools list: SDK called with tools: undefined (not an empty array)", async () => {
    mockGenerateContent.mockResolvedValue(fakeResult({ text: () => "ok" }));

    await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [],
    });

    const config = mockGetGenerativeModel.mock.calls[0][0];
    expect(config.tools).toBeUndefined();
  });

  it("propagates usageMetadata as TokenUsage on the response", async () => {
    mockGenerateContent.mockResolvedValue(
      fakeResult({
        text: () => "ok",
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 45,
          totalTokenCount: 165,
        },
      }),
    );

    const result = await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [],
    });

    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
    });
  });

  it("returns usage undefined when the SDK omits usageMetadata", async () => {
    mockGenerateContent.mockResolvedValue(fakeResult({ text: () => "ok" }));

    const result = await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [],
    });

    expect(result.usage).toBeUndefined();
  });

  it("response.text() throws (model block) → logs gemini_response_parse_error and returns empty text", async () => {
    mockGenerateContent.mockResolvedValue(
      fakeResult({
        text: () => {
          throw new Error("Candidate was blocked due to SAFETY");
        },
      }),
    );

    const result = await llmClient.query({
      systemPrompt: "sys",
      userMessage: "user",
      tools: [],
    });

    expect(result.text).toBe("");
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "gemini_response_parse_error",
        level: "warn",
        error: "Candidate was blocked due to SAFETY",
      }),
    );
  });
});

describe("analyzeDocument — fail-loud + observability (Audit H WARNING b.2)", () => {
  it("happy path → returns SDK text, does not log", async () => {
    mockGenerateContent.mockResolvedValue(
      fakeResult({ text: () => "análisis real" }),
    );

    const result = await analyzeDocument("texto del doc", "summary");

    expect(result).toBe("análisis real");
    expect(logStructured).not.toHaveBeenCalled();
  });

  it("error in generateContent → throws original + logs gemini_document_analysis_failed", async () => {
    const boom = new Error("network down");
    mockGenerateContent.mockRejectedValue(boom);

    await expect(analyzeDocument("texto", "summary")).rejects.toBe(boom);

    expect(logStructured).toHaveBeenCalledTimes(1);
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "gemini_document_analysis_failed",
        level: "warn",
        analysisType: "summary",
        error: "network down",
      }),
    );
  });

  it("error in response.text() (model block) → throws + logs", async () => {
    const blockErr = new Error("Candidate was blocked due to SAFETY");
    mockGenerateContent.mockResolvedValue(
      fakeResult({
        text: () => {
          throw blockErr;
        },
      }),
    );

    await expect(analyzeDocument("texto", "entities")).rejects.toBe(blockErr);

    expect(logStructured).toHaveBeenCalledTimes(1);
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "gemini_document_analysis_failed",
        level: "warn",
        analysisType: "entities",
        error: "Candidate was blocked due to SAFETY",
      }),
    );
  });
});
