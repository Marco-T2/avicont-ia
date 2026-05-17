/**
 * Outbound port for RAG (Retrieval-Augmented Generation) search.
 * LegacyRagAdapter wraps RagService from features/documents/rag/server at C2.
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */

export type RagScope = string;

/**
 * RagResult.metadata — typed citation envelope (REQ-30).
 *
 * Shape FLIPPED from `Record<string, unknown> | undefined` to a typed required
 * object. Surfaced per [[invariant_collision_elevation]] as a breaking change
 * for any future port consumer; the SOLE current consumer (`buildRagContext`)
 * is updated atomically in the same SDD.
 *
 * sectionPath is `string | null` (not `string | undefined`) — the value is
 * always present; null is the explicit absence when no section header was
 * detected by the chunker (F2 populates non-null when detected).
 */
export interface RagResultMetadata {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  sectionPath: string | null;
}

export interface RagResult {
  content: string;
  score: number;
  metadata: RagResultMetadata;
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
