import { BaseRepository } from "@/features/shared/base.repository";
import type {
  DocumentSignatureConfig,
  DocumentPrintType,
} from "@/generated/prisma/client";
import type { UpdateSignatureConfigInput } from "./document-signature-config.types";

/**
 * Data access for DocumentSignatureConfig. All methods take `organizationId`
 * as the first required parameter — no overload omits it.
 *
 * REQ-OP.4 (composite (orgId, docType) upsert) and REQ-OP.7 (orgId scoping).
 */
export class DocumentSignatureConfigRepository extends BaseRepository {
  async findMany(organizationId: string): Promise<DocumentSignatureConfig[]> {
    return this.db.documentSignatureConfig.findMany({
      where: { organizationId },
    });
  }

  async findOne(
    organizationId: string,
    documentType: DocumentPrintType,
  ): Promise<DocumentSignatureConfig | null> {
    return this.db.documentSignatureConfig.findUnique({
      where: {
        organizationId_documentType: {
          organizationId,
          documentType,
        },
      },
    });
  }

  async upsert(
    organizationId: string,
    documentType: DocumentPrintType,
    data: UpdateSignatureConfigInput,
  ): Promise<DocumentSignatureConfig> {
    return this.db.documentSignatureConfig.upsert({
      where: {
        organizationId_documentType: {
          organizationId,
          documentType,
        },
      },
      create: {
        organizationId,
        documentType,
        labels: data.labels,
        showReceiverRow: data.showReceiverRow,
      },
      update: {
        labels: data.labels,
        showReceiverRow: data.showReceiverRow,
      },
    });
  }
}
