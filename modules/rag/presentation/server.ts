import "server-only";

/**
 * Presentation/server barrel for modules/rag (poc-rag-hex C2).
 *
 * REQ-002: the server-only marker MUST be line 1 (positional).
 * Barrel shape precedent: modules/tags/presentation/server.ts.
 *
 * Consumers wire through `makeRagService()` — the concrete adapters
 * (GeminiEmbeddingAdapter, PrismaVectorRepository) are deliberately NOT
 * re-exported so no caller outside modules/rag can construct them directly.
 */

export { makeRagService } from "./composition-root";
export { RagService } from "../application/rag.service";
export type { EmbeddingPort } from "../domain/ports/embedding.port";
export type { VectorStorePort } from "../domain/ports/vector-store.port";
export type { ChunkInput, SearchResult } from "../domain/rag.types";
