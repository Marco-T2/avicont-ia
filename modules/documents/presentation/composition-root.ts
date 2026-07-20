import "server-only";
import { DocumentsService } from "@/modules/documents/application/documents.service";
import { PrismaDocumentsRepository } from "@/modules/documents/infrastructure/prisma/prisma-documents.repository";
import { VercelBlobStorageAdapter } from "@/modules/documents/infrastructure/blob/vercel-blob-storage.adapter";
import { RagIndexingAdapter } from "@/modules/documents/infrastructure/rag-indexing.adapter";
import { makeRagService } from "@/modules/rag/presentation/server";
import { PrismaTagsRepository } from "@/modules/tags/infrastructure/prisma/prisma-tags.repository";

/**
 * Composition root factory for DocumentsService.
 * Wires concrete adapters: PrismaDocumentsRepository + VercelBlobStorageAdapter +
 * RagIndexingAdapter over modules/rag's RagService (the only place allowed to
 * name that concrete adapter) + PrismaTagsRepository for the F5/REQ-45
 * upload-time tag attachment path.
 */
export function makeDocumentsService(): DocumentsService {
  return new DocumentsService(
    new PrismaDocumentsRepository(),
    new VercelBlobStorageAdapter(),
    new RagIndexingAdapter(makeRagService()),
    new PrismaTagsRepository(),
  );
}
