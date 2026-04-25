import "server-only";
import {
  GoogleGenerativeAI,
  type FunctionCall,
  type FunctionDeclaration,
} from "@google/generative-ai";
import { z } from "zod";
import { logStructured } from "@/lib/logging/structured";
import type {
  LLMClient,
  LLMQuery,
  LLMResponse,
  TokenUsage,
  Tool,
  ToolCall,
} from "./types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "La API KEY de GEMINI no está configurada en las variables de entorno",
  );
}

const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_ID = "gemini-2.5-flash";

// ── Adapter (private, both directions live here so the SDK never leaks) ──

/**
 * Strip JSON Schema fields the Gemini SDK does not accept. Zod emits
 * `$schema` at the root and `additionalProperties: false` on every object;
 * Google's Schema type whitelists a small set of fields and rejects the rest.
 */
function sanitizeForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      out[k] = sanitizeForGemini(v);
    }
    return out;
  }
  return node;
}

function toGeminiTools(tools: readonly Tool[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: sanitizeForGemini(
      z.toJSONSchema(t.inputSchema),
    ) as FunctionDeclaration["parameters"],
  }));
}

function fromGeminiCalls(calls: FunctionCall[] | undefined): ToolCall[] {
  if (!calls) return [];
  return calls.map((c, i) => ({
    // Gemini does not issue a stable per-call id; synthesize one so the rest
    // of the system can reference the call (logs, future tool_result loop).
    id: `gem_${Date.now()}_${i}`,
    name: c.name,
    input: c.args,
  }));
}

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

function fromGeminiUsage(meta: GeminiUsage | undefined): TokenUsage | undefined {
  if (!meta) return undefined;
  // The SDK marks all three counts optional; we only emit a usage record
  // when we have at least the totals to avoid reporting misleading zeros.
  if (meta.totalTokenCount == null) return undefined;
  return {
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    totalTokens: meta.totalTokenCount,
  };
}

// ── Public client ──

class GeminiClient implements LLMClient {
  async query({
    systemPrompt,
    userMessage,
    tools,
  }: LLMQuery): Promise<LLMResponse> {
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: systemPrompt,
      tools:
        tools.length > 0
          ? [{ functionDeclarations: toGeminiTools(tools) }]
          : undefined,
    });

    const result = await model.generateContent(userMessage);
    const response = result.response;

    // response.text() throws ONLY when the candidate has bad finishReason
    // (SAFETY, RECITATION, LANGUAGE) or the prompt was blocked. For
    // function-only responses it returns "" without throwing. The catch is
    // not "hiding function calls" — it observes model blocks.
    let text = "";
    try {
      text = response.text();
    } catch (err) {
      logStructured({
        event: "gemini_response_parse_error",
        level: "warn",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      text,
      toolCalls: fromGeminiCalls(response.functionCalls()),
      usage: fromGeminiUsage(response.usageMetadata),
    };
  }
}

export const geminiClient: LLMClient = new GeminiClient();

// ── Document analysis (Gemini-bound, separate from chat-with-tools) ──

/**
 * Stays in this file because it speaks Gemini directly and does not match
 * the LLMClient chat-with-tools shape. Keeping it here preserves the
 * one-file-per-provider isolation: anything that imports
 * `@google/generative-ai` lives in this module.
 */
export async function analyzeDocument(
  text: string,
  analysisType: "summary" | "qa" | "sentiment" | "entities" | "extract",
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const prompts = {
      summary: `Please provide a comprehensive summary of the following document. Include main points, key findings, and conclusions:\n\n${text}`,
      qa: `Based on the following document, generate 5 important questions and their answers:\n\n${text}`,
      sentiment: `Analyze the sentiment and tone of the following document. Provide overall sentiment (positive/negative/neutral) and key emotional tones detected:\n\n${text}`,
      entities: `Extract all named entities (people, organizations, locations, dates, etc.) from the following document:\n\n${text}`,
      extract: `Extract key information from the following document in structured format:\n\n${text}`,
    };

    const prompt = prompts[analysisType];
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    logStructured({
      event: "gemini_document_analysis_failed",
      level: "warn",
      analysisType,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
