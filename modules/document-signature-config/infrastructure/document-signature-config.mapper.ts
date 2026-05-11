import type { DocumentSignatureConfig as PrismaDocumentSignatureConfig } from "@/generated/prisma/client";
import {
  DocumentSignatureConfig,
  type DocumentPrintType,
  type SignatureLabel,
} from "../domain/document-signature-config.entity";

export function toDomain(
  row: PrismaDocumentSignatureConfig,
): DocumentSignatureConfig {
  return DocumentSignatureConfig.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    documentType: row.documentType as DocumentPrintType,
    labels: row.labels as SignatureLabel[],
    showReceiverRow: row.showReceiverRow,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: DocumentSignatureConfig) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    organizationId: s.organizationId,
    documentType: s.documentType,
    labels: s.labels,
    showReceiverRow: s.showReceiverRow,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
