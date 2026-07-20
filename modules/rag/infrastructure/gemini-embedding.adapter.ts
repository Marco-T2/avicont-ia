import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmbeddingPort } from "../domain/ports/embedding.port";

const EMBEDDING_DIMENSIONS = 768;

/**
 * GeminiEmbeddingAdapter — infrastructure adapter implementing EmbeddingPort
 * on top of the Gemini `gemini-embedding-001` model (REQ-RAG-01).
 *
 * REQ-RAG-02 (F1, BINDING) — the GEMINI_API_KEY guard and the SDK client
 * construction live in the CONSTRUCTOR, not at module scope. Importing this
 * module with the env var unset MUST NOT throw; only constructing it does.
 * Fail-fast is preserved because the composition root constructs the adapter
 * at boot — only the MOMENT of failure moved, not the guarantee.
 *
 * A module that explodes on import poisons every module that transitively
 * touches it: nothing nearby can be instantiated in a test without mocking
 * it out. That is exactly the coupling the two dead `vi.mock` blocks on the
 * old `embedding.service` specifier existed to defuse.
 */
export class GeminiEmbeddingAdapter implements EmbeddingPort {
  private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY no está configurada en las variables de entorno",
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  }

  /** Generate embedding for a single text. */
  async embed(text: string): Promise<number[]> {
    const result = await this.model.embedContent({
      content: { parts: [{ text }], role: "user" },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as Parameters<typeof this.model.embedContent>[0]);
    return result.embedding.values;
  }

  /** Generate embeddings for multiple texts in batch. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const result = await this.model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }], role: "user" },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    } as Parameters<typeof this.model.batchEmbedContents>[0]);
    return result.embeddings.map((e) => e.values);
  }
}
