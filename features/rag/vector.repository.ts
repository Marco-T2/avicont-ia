import { prisma } from "@/lib/prisma";
import type { DocumentScope } from "@/features/shared/permissions";

interface ChunkInput {
  documentId: string;
  organizationId: string;
  scope: DocumentScope;
  content: string;
  chunkIndex: number;
  embedding: number[];
}

interface SearchResult {
  content: string;
  documentId: string;
  score: number;
}

export class VectorRepository {
  /** Store multiple chunks with their embeddings. */
  async storeChunks(chunks: ChunkInput[]): Promise<void> {
    for (const chunk of chunks) {
      const vectorStr = `[${chunk.embedding.join(",")}]`;
      await prisma.$queryRawUnsafe(
        `INSERT INTO "document_chunks" ("id", "documentId", "organizationId", "scope", "content", "chunkIndex", "embedding")
         VALUES (gen_random_uuid(), $1, $2, $3::"DocumentScope", $4, $5, $6::vector)`,
        chunk.documentId,
        chunk.organizationId,
        chunk.scope,
        chunk.content,
        chunk.chunkIndex,
        vectorStr,
      );
    }
  }

  /** Search for similar chunks within allowed scopes using cosine distance. */
  async searchSimilar(
    queryVector: number[],
    organizationId: string,
    scopes: DocumentScope[],
    topK = 5,
  ): Promise<SearchResult[]> {
    const vectorStr = `[${queryVector.join(",")}]`;
    const scopePlaceholders = scopes.map((_, i) => `$${i + 3}::"DocumentScope"`).join(", ");

    const results = await prisma.$queryRawUnsafe<
      { content: string; documentId: string; score: number }[]
    >(
      `SELECT "content", "documentId", 1 - ("embedding" <=> $1::vector) AS score
       FROM "document_chunks"
       WHERE "organizationId" = $2
         AND "scope" IN (${scopePlaceholders})
       ORDER BY "embedding" <=> $1::vector
       LIMIT ${topK}`,
      vectorStr,
      organizationId,
      ...scopes,
    );

    return results;
  }

  /** Delete all chunks for a document. */
  async deleteByDocument(documentId: string): Promise<void> {
    await prisma.$queryRawUnsafe(
      `DELETE FROM "document_chunks" WHERE "documentId" = $1`,
      documentId,
    );
  }
}
