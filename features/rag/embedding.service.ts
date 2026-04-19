import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY no está configurada en las variables de entorno",
  );
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const EMBEDDING_DIMENSIONS = 768;

export class EmbeddingService {
  /** Generate embedding for a single text. */
  async embed(text: string): Promise<number[]> {
    const result = await model.embedContent({
      content: { parts: [{ text }], role: "user" },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as Parameters<typeof model.embedContent>[0]);
    return result.embedding.values;
  }

  /** Generate embeddings for multiple texts in batch. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }], role: "user" },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    } as Parameters<typeof model.batchEmbedContents>[0]);
    return result.embeddings.map((e) => e.values);
  }
}
