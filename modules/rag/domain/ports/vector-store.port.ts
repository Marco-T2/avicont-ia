/**
 * VectorStorePort — outbound port for chunk persistence + similarity search
 * (REQ-RAG-01).
 *
 * Derived from the concrete surface of
 * features/documents/rag/vector.repository.ts (storeChunks / searchSimilar /
 * deleteByDocument — the only three methods RagService consumes).
 *
 * domain/ — R5 absoluta: the server-only marker is BANNED here (REQ-005 NEGATIVE),
 * no Prisma. The `extends BaseRepository` coupling stays in
 * modules/rag/infrastructure/prisma/prisma-vector.repository.ts (REQ-RAG-03).
 */
import type { DocumentScope } from "@/modules/permissions/domain/permissions";
import type { ChunkInput, SearchResult } from "../rag.types";

export interface VectorStorePort {
  /** Persist multiple chunks together with their embedding vectors. */
  storeChunks(chunks: ChunkInput[]): Promise<void>;

  /**
   * Search for similar chunks within the allowed scopes using cosine distance.
   *
   * REQ-30 — results are enriched with `documentName`, `chunkIndex` and
   * `sectionPath` so citations render without a follow-up query.
   *
   * `topK` is OPTIONAL at the port boundary; the concrete adapter owns the
   * default (`topK = 5`) so the port stays free of policy.
   *
   * `tagIds` (REQ-43, 5th positional) is OPTIONAL and MUST stay optional.
   * `undefined` is the back-compat path meaning "apply no tag JOIN/HAVING at
   * all" — LegacyRagAdapter.resolveTagIds deliberately returns `undefined` in
   * three branches. Making this required breaks tag filtering silently.
   * When non-empty, AND-semantics apply: every result chunk's parent document
   * must carry ALL provided tag IDs.
   */
  searchSimilar(
    queryVector: number[],
    organizationId: string,
    scopes: DocumentScope[],
    topK?: number,
    tagIds?: string[],
  ): Promise<SearchResult[]>;

  /** Delete every chunk belonging to a document. */
  deleteByDocument(documentId: string): Promise<void>;
}
