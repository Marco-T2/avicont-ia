import "server-only";
import { RagService } from "@/features/documents/rag/server";
import type {
  RagPort,
  RagResult,
  RagScope,
} from "../domain/ports/rag.port";
import type { DocumentScope } from "@/features/permissions";
import type { TagsRepositoryPort } from "@/modules/tags/domain/ports/tags-repository.port";

/**
 * LegacyRagAdapter — implements RagPort by wrapping RagService from
 * @/features/documents/rag/server.
 *
 * REQ-004: insulation point — this is the ONE location in modules/ai-agent
 * that imports from @/features/documents/rag. The application layer
 * consumes RagPort.
 *
 * Narrow surface: search() only. RagService's indexDocument/deleteByDocument
 * are write operations owned by the documents feature, not the agent.
 *
 * R3 documented: features/documents/rag/ is not yet hexified. When
 * poc-rag-hex executes, this is the single-line fix (D7 — paired sister
 * cross-feature legacy adapter pattern, no dispatch analog for RagPort).
 *
 * REQ-43 (tags filter) — the adapter accepts an optional TagsRepositoryPort
 * so it can resolve slug strings to tag IDs before delegating to RagService.
 * The repo dep is OPTIONAL (defaulting to undefined) so existing callers
 * that never pass tags continue to work without DI wiring changes.
 * Unknown slugs are silently dropped (filtered by findBySlugs returning
 * the existing set only). When the resolved ID set is empty (either no
 * slugs requested or every slug unknown), the 5th positional arg to
 * RagService.search is `undefined` — the existing back-compat path.
 */
export class LegacyRagAdapter implements RagPort {
  private readonly ragService: RagService;
  private readonly tagsRepo?: TagsRepositoryPort;

  constructor(
    ragService: RagService = new RagService(),
    tagsRepo?: TagsRepositoryPort,
  ) {
    this.ragService = ragService;
    this.tagsRepo = tagsRepo;
  }

  async search(
    query: string,
    orgId: string,
    scopes: RagScope[],
    limit: number,
    tags?: string[],
  ): Promise<RagResult[]> {
    const tagIds = await this.resolveTagIds(orgId, tags);
    const rows = await this.ragService.search(
      query,
      orgId,
      scopes as DocumentScope[],
      limit,
      tagIds,
    );
    return rows.map((r) => ({
      content: r.content,
      score: r.score,
      metadata: {
        documentId: r.documentId,
        // REQ-30/35 — documentName + chunkIndex flow from VectorRepository's
        // Document JOIN; sectionPath flows from the chunker via
        // DocumentChunk.sectionPath (nullable when no detector fired).
        documentName: r.documentName,
        chunkIndex: r.chunkIndex,
        sectionPath: r.sectionPath,
      },
    }));
  }

  /**
   * REQ-43 — resolve slug strings to tag IDs. Returns `undefined` when no
   * filter was requested OR when all slugs were unknown, so downstream
   * RagService.search sees the existing back-compat shape (no tagIds
   * positional arg => no JOIN/HAVING in VectorRepository).
   */
  private async resolveTagIds(
    orgId: string,
    tags: string[] | undefined,
  ): Promise<string[] | undefined> {
    if (!tags || tags.length === 0) return undefined;
    if (!this.tagsRepo) return undefined;
    const rows = await this.tagsRepo.findBySlugs(orgId, tags);
    if (rows.length === 0) return undefined;
    return rows.map((t) => t.id);
  }
}
