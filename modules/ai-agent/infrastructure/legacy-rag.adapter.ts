import "server-only";
import { RagService } from "@/features/documents/rag/server";
import type {
  RagPort,
  RagResult,
  RagScope,
} from "../domain/ports/rag.port";
import type { DocumentScope } from "@/features/permissions";

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
 */
export class LegacyRagAdapter implements RagPort {
  private readonly ragService: RagService;

  constructor(ragService: RagService = new RagService()) {
    this.ragService = ragService;
  }

  async search(
    query: string,
    orgId: string,
    scopes: RagScope[],
    limit: number,
  ): Promise<RagResult[]> {
    const rows = await this.ragService.search(
      query,
      orgId,
      scopes as DocumentScope[],
      limit,
    );
    return rows.map((r) => ({
      content: r.content,
      score: r.score,
      metadata: { documentId: r.documentId },
    }));
  }
}
