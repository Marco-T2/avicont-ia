/**
 * RagService — application layer (hex).
 *
 * R5 absoluta: the server-only marker is BANNED here (REQ-005 NEGATIVE).
 * This layer depends ONLY on the two outbound ports (EmbeddingPort +
 * VectorStorePort) — no Gemini SDK, no Prisma. Concrete adapters are wired
 * at modules/rag/presentation/composition-root.ts (REQ-RAG-01).
 *
 * Ports arrive by constructor injection; the pre-migration zero-arg ctor
 * that self-constructed `new EmbeddingService()` / `new VectorRepository()`
 * was a composition root hidden inside the application layer.
 */
import type { DocumentScope } from "@/modules/permissions/domain/permissions";
import type { EmbeddingPort } from "../domain/ports/embedding.port";
import type { VectorStorePort } from "../domain/ports/vector-store.port";
import type { SearchResult } from "../domain/rag.types";
import { chunkText } from "../domain/chunking";

export class RagService {
  constructor(
    private readonly embedding: EmbeddingPort,
    private readonly vectorStore: VectorStorePort,
  ) {}

  /** Chunk text, generate embeddings, and store chunks for a document. */
  async indexDocument(
    documentId: string,
    organizationId: string,
    scope: DocumentScope,
    text: string,
  ): Promise<void> {
    const chunks = chunkText(text);
    const embeddings = await this.embedding.embedBatch(
      chunks.map((c) => c.content),
    );

    // REQ-35 — sectionPath emitted by the chunker is forwarded to
    // storeChunks → DocumentChunk.sectionPath (nullable VARCHAR(512)).
    await this.vectorStore.storeChunks(
      chunks.map((chunk, index) => ({
        documentId,
        organizationId,
        scope,
        content: chunk.content,
        chunkIndex: index,
        sectionPath: chunk.sectionPath,
        embedding: embeddings[index],
      })),
    );
  }

  /**
   * Embed a query and search for similar document chunks.
   *
   * Return shape carries `documentName` + `chunkIndex` for citations (REQ-30),
   * populated by the vector store adapter via the documents JOIN.
   *
   * `tagIds` (REQ-43) — when non-empty the vector store filters via a
   * conditional JOIN over document_tags + HAVING COUNT(DISTINCT tagId) = N
   * (AND-semantics). Slug -> ID resolution happens upstream in
   * LegacyRagAdapter so this layer stays Tag-model-agnostic.
   */
  async search(
    query: string,
    organizationId: string,
    scopes: DocumentScope[],
    topK = 5,
    tagIds?: string[],
  ): Promise<SearchResult[]> {
    const queryVector = await this.embedding.embed(query);
    return this.vectorStore.searchSimilar(
      queryVector,
      organizationId,
      scopes,
      topK,
      tagIds,
    );
  }

  /** Delete all chunks for a document. */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.vectorStore.deleteByDocument(documentId);
  }
}
