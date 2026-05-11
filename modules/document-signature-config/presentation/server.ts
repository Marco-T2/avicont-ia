import "server-only";

export {
  makeDocumentSignatureConfigService,
  PrismaDocumentSignatureConfigsRepository,
} from "./composition-root";

export {
  updateSignatureConfigSchema,
  signatureLabelEnum,
  documentPrintTypeEnum,
} from "./validation";

export {
  DocumentSignatureConfig,
  ALL_DOCUMENT_PRINT_TYPES,
  ALL_SIGNATURE_LABELS,
} from "../domain/document-signature-config.entity";
export type {
  DocumentSignatureConfigProps,
  UpsertDocumentSignatureConfigInput,
  DocumentSignatureConfigSnapshot,
  DocumentPrintType,
  SignatureLabel,
} from "../domain/document-signature-config.entity";
export type { DocumentSignatureConfigsRepository } from "../domain/document-signature-config.repository";
export {
  DocumentSignatureConfigService,
  type DocumentSignatureConfigView,
} from "../application/document-signature-config.service";
export type { DocumentSignatureConfigsInquiryPort } from "../domain/ports/document-signature-config-inquiry.port";
