import "server-only";
import { RagService } from "../application/rag.service";
import { GeminiEmbeddingAdapter } from "../infrastructure/gemini-embedding.adapter";
import { PrismaVectorRepository } from "../infrastructure/prisma/prisma-vector.repository";

/**
 * Composition root for modules/rag — the ONE place that knows which concrete
 * adapters back the two outbound ports (REQ-RAG-01).
 *
 * Shape precedent: modules/tags/presentation/composition-root.ts
 * (`makeTagsService()`).
 *
 * REQ-RAG-02 — constructing GeminiEmbeddingAdapter here is what preserves
 * fail-fast on a missing GEMINI_API_KEY: the throw moved from module-import
 * time into the adapter constructor, and this factory is the boot-time caller.
 */
export function makeRagService(): RagService {
  return new RagService(
    new GeminiEmbeddingAdapter(),
    new PrismaVectorRepository(),
  );
}
