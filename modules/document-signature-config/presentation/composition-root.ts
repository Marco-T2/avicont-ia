import "server-only";
import { DocumentSignatureConfigService } from "../application/document-signature-config.service";
import { PrismaDocumentSignatureConfigsRepository } from "../infrastructure/prisma-document-signature-configs.repository";

export { PrismaDocumentSignatureConfigsRepository };

export function makeDocumentSignatureConfigService(): DocumentSignatureConfigService {
  return new DocumentSignatureConfigService(
    new PrismaDocumentSignatureConfigsRepository(),
  );
}
