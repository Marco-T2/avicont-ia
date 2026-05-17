import "server-only";
import { DocumentsService } from "@/modules/documents/application/documents.service";
import { PrismaDocumentsRepository } from "@/modules/documents/infrastructure/prisma/prisma-documents.repository";
import { VercelBlobStorageAdapter } from "@/modules/documents/infrastructure/blob/vercel-blob-storage.adapter";
// cross-module canonical-bypass REQ-004 — rag/ stays at features path (poc-rag-hex)
import { RagService } from "@/features/documents/rag/server";
import { PrismaTagsRepository } from "@/modules/tags/infrastructure/prisma/prisma-tags.repository";
import { InMemoryReindexLock } from "@/modules/documents/infrastructure/in-memory-reindex-lock";

/**
 * F6/REQ-48 — module-scoped singleton so every makeDocumentsService() call
 * shares the same lock instance across requests. A new lock per request
 * collapses the 409 contract (each request would see an empty Set).
 *
 * Known caveat (design §4): Next.js dev mode HMR may reload this module
 * and lose state; production single-process deployment keeps the lock
 * coherent. Multi-process / multi-instance: REQ-47 delete+insert is
 * idempotent so the worst case is duplicate embedding spend — out of
 * scope for this SDD.
 */
const reindexLockSingleton = new InMemoryReindexLock();

/**
 * Composition root factory for DocumentsService.
 * Wires concrete adapters: PrismaDocumentsRepository + VercelBlobStorageAdapter +
 * cross-module RagService (REQ-004 — rag/ remains at @/features/documents/rag/)
 * + PrismaTagsRepository for the F5/REQ-45 upload-time tag attachment path
 * + module-scoped InMemoryReindexLock for the F6/REQ-48 per-org concurrency gate.
 */
export function makeDocumentsService(): DocumentsService {
  return new DocumentsService(
    new PrismaDocumentsRepository(),
    new VercelBlobStorageAdapter(),
    new RagService(),
    new PrismaTagsRepository(),
    reindexLockSingleton,
  );
}
