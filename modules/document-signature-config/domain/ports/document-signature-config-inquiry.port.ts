import type { DocumentPrintType, SignatureLabel } from "../document-signature-config.entity";

export type DocumentSignatureConfigSnapshot = {
  id: string;
  organizationId: string;
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface DocumentSignatureConfigsInquiryPort {
  listAll(
    organizationId: string,
  ): Promise<DocumentSignatureConfigSnapshot[]>;
  getOrDefault(
    organizationId: string,
    documentType: DocumentPrintType,
  ): Promise<DocumentSignatureConfigSnapshot>;
}
