import type {
  DocumentSignatureConfig,
  DocumentPrintType,
} from "./document-signature-config.entity";

export interface DocumentSignatureConfigsRepository {
  findMany(organizationId: string): Promise<DocumentSignatureConfig[]>;
  findOne(
    organizationId: string,
    documentType: DocumentPrintType,
  ): Promise<DocumentSignatureConfig | null>;
  save(config: DocumentSignatureConfig): Promise<void>;
}
