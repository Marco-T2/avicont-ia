import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeDocumentSignatureConfigService } from "@/modules/document-signature-config/presentation/server";

const documentSignatureConfigService = makeDocumentSignatureConfigService();

/**
 * GET /api/organizations/[orgSlug]/signature-configs
 *
 * Returns exactly 8 DocumentSignatureConfigView entries — one per
 * DocumentPrintType — in canonical order. Missing rows project to
 * `{ labels: [], showReceiverRow: false }` without touching the DB.
 *
 * REQ-OP.4, REQ-OP.6.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission(
      "accounting-config",
      "write",
      orgSlug,
    );

    const views = await documentSignatureConfigService.listAll(orgId);
    return Response.json(views);
  } catch (error) {
    return handleError(error);
  }
}
