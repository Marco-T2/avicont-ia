import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { DocumentScope } from "@/features/permissions";

interface ChunkInput {
  documentId: string;
  organizationId: string;
  scope: DocumentScope;
  content: string;
  chunkIndex: number;
  /**
   * REQ-35 — hierarchical section context emitted by the chunker
   * (markdown header chain / numbered code / all-caps). null when no
   * detector fired in the parent context. Persisted into
   * `document_chunks.sectionPath` (VARCHAR(512), nullable).
   */
  sectionPath: string | null;
  embedding: number[];
}

interface SearchResult {
  content: string;
  documentId: string;
  score: number;
  /** REQ-30 — `documents.name` joined into the result. */
  documentName: string;
  /** REQ-30 — `document_chunks.chunkIndex` carried up for citations. */
  chunkIndex: number;
  /** REQ-30 — `document_chunks.sectionPath` carried up for citations. */
  sectionPath: string | null;
}

export class VectorRepository extends BaseRepository {
  /** Almacena múltiples fragmentos con sus incrustaciones..*/
  async storeChunks(chunks: ChunkInput[]): Promise<void> {
    for (const chunk of chunks) {
      const vectorStr = `[${chunk.embedding.join(",")}]`;
      await this.db.$queryRawUnsafe(
        `INSERT INTO "document_chunks" ("id", "documentId", "organizationId", "scope", "content", "chunkIndex", "sectionPath", "embedding")
         VALUES (gen_random_uuid(), $1, $2, $3::"DocumentScope", $4, $5, $6, $7::vector)`,
        chunk.documentId,
        chunk.organizationId,
        chunk.scope,
        chunk.content,
        chunk.chunkIndex,
        chunk.sectionPath,
        vectorStr,
      );
    }
  }

  /**
   * Search for similar chunks within allowed scopes using cosine distance.
   *
   * REQ-30 — JOINs `documents` to enrich each row with `documentName` and
   * pulls `chunkIndex` from the chunk row so citations can be rendered at
   * the application layer without a follow-up query.
   */
  async searchSimilar(
    queryVector: number[],
    organizationId: string,
    scopes: DocumentScope[],
    topK = 5,
  ): Promise<SearchResult[]> {
    const vectorStr = `[${queryVector.join(",")}]`;
    const limitParamIndex = scopes.length + 3;
    const scopePlaceholders = scopes
      .map((_, i) => `$${i + 3}::"DocumentScope"`)
      .join(", ");

    const results = await this.db.$queryRawUnsafe<SearchResult[]>(
      `SELECT dc."content",
              dc."documentId",
              dc."chunkIndex",
              dc."sectionPath",
              d."name" AS "documentName",
              1 - (dc."embedding" <=> $1::vector) AS score
       FROM "document_chunks" dc
       JOIN "documents" d ON d."id" = dc."documentId"
       WHERE dc."organizationId" = $2
         AND dc."scope" IN (${scopePlaceholders})
       ORDER BY dc."embedding" <=> $1::vector
       LIMIT $${limitParamIndex}`,
      vectorStr,
      organizationId,
      ...scopes,
      topK,
    );

    return results;
  }

  /** Delete all chunks for a document. */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.db.$queryRawUnsafe(
      `DELETE FROM "document_chunks" WHERE "documentId" = $1`,
      documentId,
    );
  }
}
