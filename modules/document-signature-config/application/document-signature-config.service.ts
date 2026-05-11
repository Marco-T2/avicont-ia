import {
  DocumentSignatureConfig,
  ALL_DOCUMENT_PRINT_TYPES,
  type DocumentPrintType,
  type SignatureLabel,
  type UpsertDocumentSignatureConfigInput,
  type DocumentSignatureConfigSnapshot,
} from "../domain/document-signature-config.entity";
import type { DocumentSignatureConfigsRepository } from "../domain/document-signature-config.repository";

/** View returned by listAll / getOrDefault — one per docType, flat. */
export interface DocumentSignatureConfigView {
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
}

export class DocumentSignatureConfigService {
  constructor(
    private readonly repo: DocumentSignatureConfigsRepository,
  ) {}

  async listAll(
    organizationId: string,
  ): Promise<DocumentSignatureConfigView[]> {
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
          labels: [...row.labels],
          showReceiverRow: row.showReceiverRow,
        };
      }
      return {
        documentType,
        labels: [] as SignatureLabel[],
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
        labels: [...row.labels],
        showReceiverRow: row.showReceiverRow,
      };
    }
    return {
      documentType,
      labels: [] as SignatureLabel[],
      showReceiverRow: false,
    };
  }

  async upsert(
    organizationId: string,
    documentType: DocumentPrintType,
    input: UpsertDocumentSignatureConfigInput,
  ): Promise<DocumentSignatureConfigSnapshot> {
    const existing = await this.repo.findOne(organizationId, documentType);
    if (existing) {
      existing.updateConfig(input);
      await this.repo.save(existing);
      return existing.toSnapshot();
    }
    const config = DocumentSignatureConfig.create(
      organizationId,
      documentType,
      input,
    );
    await this.repo.save(config);
    return config.toSnapshot();
  }
}
