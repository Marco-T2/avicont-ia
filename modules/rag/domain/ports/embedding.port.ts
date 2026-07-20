/**
 * EmbeddingPort — outbound port for text vectorization (REQ-RAG-01).
 *
 * Derived from the concrete surface of features/documents/rag/embedding.service.ts
 * (`embed` + `embedBatch`, the only two methods RagService consumes).
 *
 * domain/ — R5 absoluta: the server-only marker is BANNED here (REQ-005 NEGATIVE),
 * no @google/generative-ai import. The Gemini SDK and the GEMINI_API_KEY
 * fail-fast live in modules/rag/infrastructure/gemini-embedding.adapter.ts.
 */
export interface EmbeddingPort {
  /** Generate an embedding vector for a single text. */
  embed(text: string): Promise<number[]>;

  /** Generate embedding vectors for multiple texts in one batch call. */
  embedBatch(texts: string[]): Promise<number[][]>;
}
