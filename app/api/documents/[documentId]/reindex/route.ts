/**
 * POST /api/documents/[documentId]/reindex — re-run the RAG pipeline for an
 * existing document (REQ-47) with per-org concurrency lock (REQ-48).
 *
 * Auth model mirrors DELETE /api/documents/[documentId] per
 * [[paired_sister_default_no_surface]]: `requireAuth` here, service-side
 * RBAC inside DocumentsService.reindex (findByIdWithMembers — empty
 * members list → ForbiddenError; missing doc → NotFoundError).
 *
 * The per-org concurrency lock lives inside DocumentsService.reindex itself
 * (acquired against doc.organizationId AFTER findByIdWithMembers resolves,
 * released in finally). On contention the service throws ConflictError and
 * the shared error serializer maps to HTTP 409 with the prescribed Spanish
 * copy "Reindexación en curso para esta organización".
 *
 * Composition root caveat (design §4): the InMemoryReindexLock is a
 * module-scoped singleton in modules/documents/presentation/composition-root.ts.
 * Next.js dev-mode HMR can reload that module and lose lock state — accepted
 * limitation per design. Production single-process deployment keeps state
 * coherent; multi-process deployments risk duplicate-but-idempotent reindex
 * runs (REQ-47 delete+insert is safe to repeat).
 */
import { requireAuth, handleError } from "@/features/shared/middleware";
import { makeDocumentsService } from "@/modules/documents/presentation/server";

const service = makeDocumentsService();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const { userId } = await requireAuth();

    const result = await service.reindex(documentId, userId);

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
