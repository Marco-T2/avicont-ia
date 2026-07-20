import "server-only";
import { BaseRepository } from "@/modules/shared/infrastructure/base.repository";
import type { DocumentScope } from "@/modules/permissions/domain/permissions";
import type { VectorStorePort } from "../../domain/ports/vector-store.port";
import type { ChunkInput, SearchResult } from "../../domain/rag.types";

/**
 * PrismaVectorRepository — pgvector-backed VectorStorePort adapter.
 *
 * REQ-RAG-03 — extends the shared BaseRepository like the other 17 modules
 * (house convention, not a new cross-module coupling).
 *
 * `ChunkInput` / `SearchResult` were module-private interfaces here before
 * the migration; they now live in modules/rag/domain/rag.types.ts so the
 * port and this adapter share one canonical definition.
 */
export class PrismaVectorRepository
  extends BaseRepository
  implements VectorStorePort
{
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
   *
   * REQ-43 — When `tagIds` is non-empty applies AND-semantics tag filter:
   * adds an INNER JOIN over `document_tags` restricted to the provided tag
   * IDs, GROUP BY the unique-chunk columns, and HAVING COUNT(DISTINCT
   * tagId) = N so only chunks whose parent Document carries ALL provided
   * tags survive. Tag IDs travel as bound parameters (no string
   * interpolation) — α-SQL-injection sentinel.
   */
  async searchSimilar(
    queryVector: number[],
    organizationId: string,
    scopes: DocumentScope[],
    topK = 5,
    tagIds?: string[],
  ): Promise<SearchResult[]> {
    const vectorStr = `[${queryVector.join(",")}]`;
    const hasTags = !!tagIds && tagIds.length > 0;
    const tagCount = hasTags ? tagIds!.length : 0;
    // Param layout:
    //   $1                                vector
    //   $2                                organizationId
    //   $3 .. $(2 + scopes.length)        scopes
    //   $(2 + scopes.length + 1) ..       tagIds (if hasTags)
    //   $LAST                             topK
    const scopePlaceholders = scopes
      .map((_, i) => `$${i + 3}::"DocumentScope"`)
      .join(", ");

    let tagJoin = "";
    let tagWhere = "";
    let tagGroupHaving = "";
    if (hasTags) {
      const firstTagIdx = scopes.length + 3;
      const tagPlaceholders = tagIds!
        .map((_, i) => `$${firstTagIdx + i}`)
        .join(", ");
      tagJoin = `JOIN "document_tags" dt ON dt."documentId" = d."id"`;
      tagWhere = `AND dt."tagId" IN (${tagPlaceholders})`;
      tagGroupHaving = `GROUP BY dc."id", dc."content", dc."documentId", dc."chunkIndex", dc."sectionPath", d."name", dc."embedding"
        HAVING COUNT(DISTINCT dt."tagId") = ${tagCount}`;
    }

    const limitParamIndex = scopes.length + 3 + tagCount;

    const sql = `SELECT dc."content",
              dc."documentId",
              dc."chunkIndex",
              dc."sectionPath",
              d."name" AS "documentName",
              1 - (dc."embedding" <=> $1::vector) AS score
       FROM "document_chunks" dc
       JOIN "documents" d ON d."id" = dc."documentId"
       ${tagJoin}
       WHERE dc."organizationId" = $2
         AND dc."scope" IN (${scopePlaceholders})
         ${tagWhere}
       ${tagGroupHaving}
       ORDER BY dc."embedding" <=> $1::vector
       LIMIT $${limitParamIndex}`;

    const params: unknown[] = [
      vectorStr,
      organizationId,
      ...scopes,
      ...(hasTags ? tagIds! : []),
      topK,
    ];

    const results = await this.db.$queryRawUnsafe<SearchResult[]>(sql, ...params);

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
