import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { DocumentSignatureConfigService } from "@/features/document-signature-config/server";
import {
  documentPrintTypeEnum,
  updateSignatureConfigSchema,
} from "@/features/document-signature-config";

const documentSignatureConfigService = new DocumentSignatureConfigService();

/**
 * PATCH /api/organizations/[orgSlug]/signature-configs/[documentType]
 *
 * Upsert signature config for one DocumentPrintType.
 *
 *   - documentType: validated against documentPrintTypeEnum (400 on unknown)
 *   - body: validated against updateSignatureConfigSchema
 *     (labels array of SignatureLabel, no duplicates; showReceiverRow boolean)
 *
 * REQ-OP.4, REQ-OP.5, REQ-OP.6, REQ-OP.7.
 */
export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ orgSlug: string; documentType: string }>;
  },
) {
  try {
    const { orgSlug, documentType } = await params;
    const { orgId } = await requirePermission(
      "accounting-config",
      "write",
      orgSlug,
    );

    const docType = documentPrintTypeEnum.parse(documentType);

    const body = await request.json();
    const input = updateSignatureConfigSchema.parse(body);

    const row = await documentSignatureConfigService.upsert(
      orgId,
      docType,
      input,
    );

    return Response.json(row);
  } catch (error) {
    return handleError(error);
  }
}
