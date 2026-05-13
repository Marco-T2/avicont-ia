import "server-only";

export { makeDocumentsService } from "./composition-root";
export { DocumentsService } from "@/modules/documents/application/documents.service";
export type {
  DocumentsRepositoryPort,
} from "@/modules/documents/application/documents.service";
export type { BlobStoragePort } from "@/modules/documents/domain/ports/blob-storage.port";
export type {
  DocumentWithRelations,
  CreateDocumentInput,
  DocumentListResult,
  DocumentUploadResult,
} from "@/modules/documents/domain/documents.types";

export {
  createDocumentSchema,
  listDocumentsSchema,
  analyzeDocumentSchema,
} from "./validation/documents.validation";
