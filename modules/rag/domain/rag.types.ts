/**
 * RAG domain types — lifted verbatim from
 * features/documents/rag/vector.repository.ts:5-31 (REQ-RAG-01).
 *
 * domain/ — R5 absoluta: the server-only marker is BANNED here (REQ-005 NEGATIVE).
 * These shapes were previously module-private interfaces on the Prisma
 * repository; hoisting them to domain lets both the port and the adapter
 * reference one canonical definition.
 */
import type { DocumentScope } from "@/modules/permissions/domain/permissions";

export interface ChunkInput {
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

export interface SearchResult {
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
