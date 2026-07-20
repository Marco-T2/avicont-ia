/**
 * DocumentIndexingPort — outbound port replacing the REQ-004 cross-module
 * canonical-bypass (`import { RagService } from "@/features/documents/rag/server"`)
 * inside DocumentsService.
 *
 * WRITE-ONLY and deliberately disjoint from modules/ai-agent's read-only
 * RagPort: documents indexes and deletes, the agent searches. Exactly two
 * methods — the only two DocumentsService actually calls
 * (documents.service.ts upload() → indexDocument, delete() → deleteByDocument).
 * No `search` here: adding it would re-couple documents to a surface it never
 * uses.
 *
 * modules/documents/infrastructure/rag-indexing.adapter.ts implements this
 * explicitly (F2 — no structural typing); only composition-root.ts may import
 * that concrete adapter.
 *
 * domain/ — R5 absoluta: the server-only marker is BANNED here (REQ-005 NEGATIVE).
 */
import type { DocumentScope } from "@/modules/permissions/domain/permissions";

export interface DocumentIndexingPort {
  /** Chunk, embed and store a document's extracted text. */
  indexDocument(
    documentId: string,
    organizationId: string,
    scope: DocumentScope,
    text: string,
  ): Promise<void>;

  /** Delete every indexed chunk belonging to a document. */
  deleteByDocument(documentId: string): Promise<void>;
}
