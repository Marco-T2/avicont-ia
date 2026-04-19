import "server-only";
import { DocumentSignatureConfigRepository } from "./document-signature-config.repository";
import {
  ALL_DOCUMENT_PRINT_TYPES,
  type DocumentPrintType,
  type DocumentSignatureConfig,
  type DocumentSignatureConfigView,
  type UpdateSignatureConfigInput,
} from "./document-signature-config.types";

/**
 * Service for DocumentSignatureConfig.
 *
 * Covers REQ-OP.4:
 *   listAll   — returns 8 views (one per DocumentPrintType), merging existing
 *               rows over the default `{ labels: [], showReceiverRow: false }`
 *               shape; NEVER inserts as a side-effect of reading.
 *   getOrDefault — returns the view for a single doc type, defaulting to
 *                  empty labels / false if missing; NEVER inserts.
 *   upsert    — writes through to the repo by (orgId, documentType).
 */
export class DocumentSignatureConfigService {
  private readonly repo: DocumentSignatureConfigRepository;

  constructor(repo?: DocumentSignatureConfigRepository) {
    this.repo = repo ?? new DocumentSignatureConfigRepository();
  }

  async listAll(organizationId: string): Promise<DocumentSignatureConfigView[]> {
    const existing = await this.repo.findMany(organizationId);
    const byType = new Map<DocumentPrintType, DocumentSignatureConfig>();
    for (const row of existing) {
      byType.set(row.documentType, row);
    }

    return ALL_DOCUMENT_PRINT_TYPES.map((documentType) => {
      const row = byType.get(documentType);
      if (row) {
        return {
          documentType: row.documentType,
          labels: row.labels,
          showReceiverRow: row.showReceiverRow,
        };
      }
      return {
        documentType,
        labels: [],
        showReceiverRow: false,
      };
    });
  }

  async getOrDefault(
    organizationId: string,
    documentType: DocumentPrintType,
  ): Promise<DocumentSignatureConfigView> {
    const row = await this.repo.findOne(organizationId, documentType);
    if (row) {
      return {
        documentType: row.documentType,
        labels: row.labels,
        showReceiverRow: row.showReceiverRow,
      };
    }
    return {
      documentType,
      labels: [],
      showReceiverRow: false,
    };
  }

  async upsert(
    organizationId: string,
    documentType: DocumentPrintType,
    patch: UpdateSignatureConfigInput,
  ): Promise<DocumentSignatureConfig> {
    return this.repo.upsert(organizationId, documentType, patch);
  }
}
