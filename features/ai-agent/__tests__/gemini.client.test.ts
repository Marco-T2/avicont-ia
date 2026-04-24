/**
 * RED test — Audit H WARNING (b.1): queryWithTools loguea via logStructured
 * cuando `response.text()` tira, en vez de tragar silenciosamente el error.
 *
 * Contexto del bug: el SDK @google/generative-ai tira desde `text()` SOLO
 * cuando hay bad finishReason (SAFETY, RECITATION, LANGUAGE) o prompt
 * bloqueado. Para respuestas "function-only" SIN texto, `text()` retorna
 * "" sin tirar — el comentario original `// text() throws if the response
 * only contains function calls` era falso. El catch estaba silenciando
 * bloqueos del modelo, no casos legítimos.
 *
 * Expected failure mode en RED:
 *   - Test #3 falla con "logStructured called 0 times, expected 1" porque
 *     el catch actual está vacío.
 *   - Tests #1 y #2 pasan de entrada (guards).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key-for-vitest";
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { queryWithTools } from "../gemini.client";
import { logStructured } from "@/lib/logging/structured";

beforeEach(() => {
  vi.mocked(logStructured).mockClear();
  mockGenerateContent.mockReset();
});

type FakeResponse = {
  text: () => string;
  functionCalls: () => unknown[] | undefined;
};

function fakeResult(overrides: Partial<FakeResponse>) {
  return {
    response: {
      text: overrides.text ?? (() => ""),
      functionCalls: overrides.functionCalls ?? (() => undefined),
    },
  };
}

describe("queryWithTools — error observability (Audit H WARNING b.1)", () => {
  it("happy path con texto → no loguea, retorna texto", async () => {
    mockGenerateContent.mockResolvedValue(
      fakeResult({ text: () => "hola mundo" }),
    );

    const result = await queryWithTools("sys", "user", []);

    expect(result.text).toBe("hola mundo");
    expect(result.functionCalls).toBeUndefined();
    expect(logStructured).not.toHaveBeenCalled();
  });

  it("function-only (text() retorna '') → no loguea, retorna '' + functionCalls", async () => {
    const calls = [{ name: "doX", args: { k: "v" } }];
    mockGenerateContent.mockResolvedValue(
      fakeResult({
        text: () => "",
        functionCalls: () => calls,
      }),
    );

    const result = await queryWithTools("sys", "user", []);

    expect(result.text).toBe("");
    expect(result.functionCalls).toEqual(calls);
    expect(logStructured).not.toHaveBeenCalled();
  });

  it("error real (text() tira) → loguea gemini_response_parse_error con mensaje", async () => {
    mockGenerateContent.mockResolvedValue(
      fakeResult({
        text: () => {
          throw new Error("Candidate was blocked due to SAFETY");
        },
      }),
    );

    const result = await queryWithTools("sys", "user", []);

    expect(result.text).toBe("");
    expect(logStructured).toHaveBeenCalledTimes(1);
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "gemini_response_parse_error",
        level: "warn",
        error: "Candidate was blocked due to SAFETY",
      }),
    );
  });
});
