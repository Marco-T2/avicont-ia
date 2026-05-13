import "server-only";
import { DocumentsService } from "@/modules/documents/application/documents.service";
import { PrismaDocumentsRepository } from "@/modules/documents/infrastructure/prisma/prisma-documents.repository";
import { VercelBlobStorageAdapter } from "@/modules/documents/infrastructure/blob/vercel-blob-storage.adapter";
// cross-module canonical-bypass REQ-004 — rag/ stays at features path (poc-rag-hex)
import { RagService } from "@/features/documents/rag/server";

/**
 * Composition root factory for DocumentsService.
 * Wires concrete adapters: PrismaDocumentsRepository + VercelBlobStorageAdapter +
 * cross-module RagService (REQ-004 — rag/ remains at @/features/documents/rag/).
 */
export function makeDocumentsService(): DocumentsService {
  return new DocumentsService(
    new PrismaDocumentsRepository(),
    new VercelBlobStorageAdapter(),
    new RagService(),
  );
}
