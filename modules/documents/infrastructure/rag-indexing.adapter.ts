import "server-only";
import type { DocumentIndexingPort } from "@/modules/documents/domain/ports/document-indexing.port";
import type { RagService } from "@/modules/rag/presentation/server";
import type { DocumentScope } from "@/modules/permissions/domain/permissions";

/**
 * RagIndexingAdapter — implements DocumentIndexingPort by wrapping the
 * RagService owned by modules/rag.
 *
 * F2 (BINDING) — the adaptation is EXPLICIT, not structural. This is the ONE
 * named file that says "I adapt rag for documents": if RagService's surface
 * changes, there is exactly one place to fix, and the coupling is declared
 * rather than discovered at the composition root.
 *
 * Precedent: modules/ai-agent/infrastructure/legacy-rag.adapter.ts, which
 * adapts the same service to the agent's read-only RagPort.
 *
 * Narrow surface: indexDocument + deleteByDocument only. RagService.search is
 * a read operation owned by the agent side, deliberately not exposed here.
 */
export class RagIndexingAdapter implements DocumentIndexingPort {
  constructor(private readonly ragService: RagService) {}

  async indexDocument(
    documentId: string,
    organizationId: string,
    scope: DocumentScope,
    text: string,
  ): Promise<void> {
    await this.ragService.indexDocument(
      documentId,
      organizationId,
      scope,
      text,
    );
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.ragService.deleteByDocument(documentId);
  }
}
