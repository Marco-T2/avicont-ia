import "server-only";
import type { RagService } from "@/modules/rag/presentation/server";
import type {
  RagPort,
  RagResult,
  RagScope,
} from "../domain/ports/rag.port";
import type { DocumentScope } from "@/modules/permissions/domain/permissions";
import type { TagsRepositoryPort } from "@/modules/tags/domain/ports/tags-repository.port";

/**
 * LegacyRagAdapter — implements RagPort by wrapping the RagService exposed by
 * @/modules/rag/presentation/server.
 *
 * Insulation point — this is the ONE location in modules/ai-agent that names
 * RagService at all. The application layer consumes RagPort.
 *
 * Narrow surface: search() only. RagService's indexDocument/deleteByDocument
 * are write operations owned by modules/documents, not the agent.
 *
 * `ragService` is a REQUIRED constructor parameter (F4). It previously
 * defaulted to `new RagService()`, which made this adapter a composition root
 * in disguise — an infrastructure class that knew HOW to build its own
 * dependency. Wiring now lives in modules/ai-agent/presentation/server.ts,
 * the module's real composition root. The name kept the "Legacy" prefix for
 * continuity with the RagPort contract; it is no longer a legacy path.
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

  constructor(ragService: RagService, tagsRepo?: TagsRepositoryPort) {
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
