/**
 * Outbound port for RAG (Retrieval-Augmented Generation) search.
 * LegacyRagAdapter wraps RagService from features/documents/rag/server at C2.
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */

export type RagScope = string;

export interface RagResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * RagPort — narrow search surface.
 */
export interface RagPort {
  search(
    query: string,
    orgId: string,
    scopes: RagScope[],
    limit: number,
  ): Promise<RagResult[]>;
}
